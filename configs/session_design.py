#!/usr/bin/env python3
"""
session_design.py
=================

Generates the cue-identity design for ONE River Raid session.

CHANGED: this is no longer task-agnostic. Each task (targets / instrumental /
targets-instrumental) gets its OWN independently-randomized partition of the
same 9 shapes into k=2/k=3/k=4 groups, per run. Texture remains a run-level
property shared across all three tasks (run 1 and run 2 always use different
textures, but a given run's texture is the same regardless of task).

LOCKED DESIGN (v6 -- independent per-task shape pairings)
----------------------------------------------------------
Pool ................ 18 images = 9 distinct shapes x 2 textures (solid, dotted).
Structure ........... 2 runs; each run has one k=2, one k=3, one k=4 block --
                      PER TASK. So there are 3 tasks x 2 runs x 3 set sizes =
                      18 total cells, not 6.
Shape pairings ...... Independently randomized per (task, run). T, I, and TI
                      each get their own random partition of the 9 shapes into
                      groups of 2/3/4 -- they are generally different from each
                      other, unlike the previous design where all three tasks
                      shared the exact same partition per run.
Texture ............. Still a RUN-level property, shared across all 3 tasks:
                      whichever texture run 1 is assigned, ALL of T/I/TI's run-1
                      blocks use it (and likewise for run 2's own texture).
                      Only the shape groupings vary per task -- texture does not.
"""

import csv
import json
import random
import argparse
from collections import defaultdict
from pathlib import Path

SET_SIZES = [2, 3, 4]
TASKS = ["targets", "instrumental", "targets-instrumental"]


# ---------------------------------------------------------------------------
# Manifest -> identity lookup
# ---------------------------------------------------------------------------
def load_manifest(manifest_path):
    """Return dict[shape] -> {'manifest_index': int, 'filename': str, 'texture': str}.
    Assumes exactly one row per shape (single-texture manifest)."""
    lookup = {}
    with open(manifest_path, newline="") as f:
        for row in csv.DictReader(f):
            shape = row["shape"].strip()
            if shape in lookup:
                raise ValueError(
                    f"Manifest has more than one row for shape {shape!r} -- "
                    "this design assumes exactly one row per shape (single texture)."
                )
            lookup[shape] = {
                "manifest_index": int(row["index"]),
                "filename": row["filename"].strip(),
                "texture": row["texture"].strip(),
            }
    return lookup


# ---------------------------------------------------------------------------
# Session design
# ---------------------------------------------------------------------------
def build_session_design(seed, manifest_path):
    random.seed(seed)

    lookup = load_manifest(manifest_path)
    shapes = sorted(lookup.keys())
    assert len(shapes) == 9, f"Expected 9 distinct shapes in manifest, got {len(shapes)}: {shapes}"
    textures_used = {info["texture"] for info in lookup.values()}
    assert len(textures_used) == 1, f"Expected a single uniform texture, got {textures_used}"
    texture = next(iter(textures_used))

    pool = [
        {"shape": s, "texture": texture, "manifest_index": info["manifest_index"], "filename": info["filename"]}
        for s, info in lookup.items()
    ]

    cells = []
    for run in (1, 2):
        for task in TASKS:
            shuffled = shapes[:]
            random.shuffle(shuffled)
            # Independent random partition of the same 9 shapes, per (task, run) --
            # T, I, and TI each get their own shuffle, so their groupings generally differ.
            groups = {2: shuffled[0:2], 3: shuffled[2:5], 4: shuffled[5:9]}

            for k in SET_SIZES:
                group_shapes = groups[k]
                cues = []
                for i, s in enumerate(group_shapes):
                    info = lookup[s]
                    cues.append({
                        "cue_index": i + 1,
                        "shape": s,
                        "texture": texture,
                        "manifest_index": info["manifest_index"],
                        "filename": info["filename"],
                        "training": False,
                    })
                cells.append({
                    "task": task,
                    "run": run,
                    "set_size": k,
                    "varies": "shape",
                    "block_type": f"k{k}",
                    "shapes": group_shapes,
                    "cues": cues,
                })

    design = {
        "session_seed": seed,
        "dropped_texture": None,
        "textures": [texture],
        "pool": pool,
        "cells": cells,
    }
    validate_design(design)
    return design


# ---------------------------------------------------------------------------
# Validation: hard-assert every invariant we care about
# ---------------------------------------------------------------------------
def validate_design(design):
    cells = design["cells"]
    report = {}

    pool = design["pool"]
    assert len(pool) == 9, f"Pool size {len(pool)} != 9"
    pool_shapes = [p["shape"] for p in pool]
    assert len(set(pool_shapes)) == 9, "Pool has duplicate shapes"
    texture = design["textures"][0]
    assert all(p["texture"] == texture for p in pool), "Pool contains more than one texture"
    report["pool_is_9_distinct_shapes_one_texture"] = True

    assert set(c["task"] for c in cells) == set(TASKS), \
        f"Expected tasks {TASKS}, got {sorted(set(c['task'] for c in cells))}"

    by_task_run = defaultdict(list)
    for cell in cells:
        by_task_run[(cell["task"], cell["run"])].append(cell)
    assert len(by_task_run) == len(TASKS) * 2, \
        f"Expected {len(TASKS) * 2} (task, run) groups, got {len(by_task_run)}"

    shapes_in_pool = {p["shape"] for p in pool}
    for (task, run), group_cells in by_task_run.items():
        sizes = sorted(c["set_size"] for c in group_cells)
        assert sizes == [2, 3, 4], f"{task} run {run} sizes {sizes} != [2, 3, 4]"

        assigned_shapes = [s for c in group_cells for s in c["shapes"]]
        assert len(assigned_shapes) == 9, f"{task} run {run}: {len(assigned_shapes)} shapes assigned, expected 9"
        assert set(assigned_shapes) == shapes_in_pool, f"{task} run {run} does not cover the full 9-shape pool"
        assert len(set(assigned_shapes)) == 9, f"{task} run {run}: a shape is assigned to more than one cell"

        for cell in group_cells:
            assert len(cell["cues"]) == cell["set_size"], "Cue count != set_size"
            assert len(cell["shapes"]) == cell["set_size"], "shapes list length != set_size"
            assert set(c["shape"] for c in cell["cues"]) == set(cell["shapes"]), "cues/shapes mismatch"
    report["each_task_run_partitions_9_shapes_exactly"] = True

    # Informational: do the 3 tasks actually land on different partitions within
    # a run? True by construction with very high probability, not a hard invariant
    # (a random coincidence making two tasks match wouldn't itself be invalid).
    all_differ = True
    for run in (1, 2):
        groupings = []
        for task in TASKS:
            g = tuple(sorted((c["set_size"], frozenset(c["shapes"])) for c in by_task_run[(task, run)]))
            groupings.append(g)
        if len(set(groupings)) != len(TASKS):
            all_differ = False
    report["task_groupings_independently_randomized"] = all_differ

    design["validation"] = report
    return report


# ---------------------------------------------------------------------------
# Human-readable rendering
# ---------------------------------------------------------------------------
def render_table(design):
    lines = []
    lines.append(f"SESSION DESIGN  (seed={design['session_seed']}, texture={design['textures'][0]})")
    lines.append("")
    lines.append("CELLS")
    for cell in design["cells"]:
        head = f"  {cell['task']:<22} run {cell['run']}  k={cell['set_size']}  shapes={cell['shapes']}"
        lines.append(head)
        for c in cell["cues"]:
            lines.append(f"      cue {c['cue_index']}: {c['shape']:<10} (#{c['manifest_index']:02d} {c['filename']})")
    lines.append("")
    lines.append("VALIDATION: " + ", ".join(f"{k}={v}" for k, v in design["validation"].items()))
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Group-level audit across many sessions (set-size occupancy balance)
# ---------------------------------------------------------------------------
def audit_decorrelation(n_sessions, manifest_path, base_seed=0):
    """Across n_sessions seeds, tally each shape's set-size occupancy. Randomization
    should keep this roughly balanced: shapes near k/9 per set size."""
    from collections import Counter
    counts = defaultdict(Counter)
    for i in range(n_sessions):
        d = build_session_design(base_seed + i, manifest_path)
        for cell in d["cells"]:
            for s in cell["shapes"]:
                counts[s][cell["set_size"]] += 1

    expected = {k: k / 9 for k in SET_SIZES}
    lines = [f"DECORRELATION AUDIT over {n_sessions} sessions",
             "(each shape's share of appearances at k=2 / k=3 / k=4, "
             f"vs. expected {expected[2]:.2f}/{expected[3]:.2f}/{expected[4]:.2f})", ""]
    worst = 0.0
    for s in sorted(counts.keys()):
        c = counts[s]
        tot = sum(c.values())
        frac = {k: c[k] / tot for k in SET_SIZES}
        dev = max(abs(frac[k] - expected[k]) for k in SET_SIZES)
        worst = max(worst, dev)
        lines.append(f"  {s:<10}  k2={frac[2]:.2f} k3={frac[3]:.2f} k4={frac[4]:.2f}")
    lines.append("")
    lines.append(f"max deviation from the correct (unequal-group-size) baseline: {worst:.3f}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Generate one River Raid session cue-identity design (single-factor, 9 shapes).")
    ap.add_argument("--seed", type=int, default=0, help="Session seed (controls shape->cell assignment).")
    ap.add_argument("--manifest", required=True, help="Path to stimulus manifest.csv.")
    ap.add_argument("--out", default=None, help="Write design JSON to this path.")
    ap.add_argument("--audit", type=int, default=0, help="Run group-level decorrelation audit over N sessions.")
    args = ap.parse_args()

    design = build_session_design(args.seed, args.manifest)
    print(render_table(design))

    if args.out:
        with open(args.out, "w") as f:
            json.dump(design, f, indent=2)
        print(f"\nWrote design JSON -> {args.out}")

    if args.audit:
        print("\n" + audit_decorrelation(args.audit, args.manifest))


if __name__ == "__main__":
    main()
