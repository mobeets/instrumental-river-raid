#!/usr/bin/env python3
"""
session_design.py
=================

Generates the *task-agnostic* cue-identity design for ONE River Raid session.

This replaces the old theme / v1-v2-v3 spritesheet abstraction. It does not know
about Targets / Instrumental / Targets-Instrumental at all -- it just defines
WHICH images occupy WHICH (run, set-size) cell and HOW they are crossed. The
config generator (next step) will instantiate this identical design into all
three task blocks, so every cue appears under every task rule.

LOCKED DESIGN
-------------
Pool ................ 18 images = 6 shapes x 3 textures (dotted dropped).
                      Pool is FIXED across sessions; what rotates per session
                      is the image->cell assignment (decorrelates identity from
                      set-size at the group level).
Structure ........... 2 runs; each run has one k=2, one k=3, one k=4 block.
                      Banded: the 9 images in a run (2+3+4) are all distinct and
                      appear in exactly one cell. Two runs -> all 18, no repeats.
k=4 ................. true 2x2 factorial (2 shapes x 2 textures). Lets you
                      estimate shape main effect, texture main effect, and the
                      shape x texture interaction (conjunctive/mixed selectivity)
                      WITHIN a single task context.
k=2 / k=3 ........... single-dimension blocks (only shape OR only texture varies).
                      Within a run, k=2 and k=3 vary DIFFERENT dimensions; across
                      the two runs that assignment flips.
                        recipe A: k2 varies shape,   k3 varies texture
                        recipe B: k2 varies texture, k3 varies shape
                      Exactly one run gets A and one gets B (which run is which is
                      randomized per session).

The whole 6-cell layout is an exact tiling of the 6x3 (shape x texture) grid.
Pool-level orthogonality (shape independent of texture) is guaranteed because the
pool is the full 6x3 cross used once each.
"""

import csv
import json
import random
import argparse
from itertools import combinations
from collections import Counter, defaultdict
from pathlib import Path

SHAPES = ["triangle", "square", "circle", "heart", "crescent", "star"]
ALL_TEXTURES = ["outline", "hatch", "solid", "dotted"]  # manifest column order
DEFAULT_DROPPED_TEXTURE = "dotted"
SET_SIZES = [2, 3, 4]

DEFAULT_MANIFEST = "/mnt/user-data/uploads/manifest.csv"


# ---------------------------------------------------------------------------
# Manifest -> identity lookup
# ---------------------------------------------------------------------------
def load_manifest(manifest_path):
    """Return dict[(shape, texture)] -> {'manifest_index': int, 'filename': str}."""
    lookup = {}
    with open(manifest_path, newline="") as f:
        for row in csv.DictReader(f):
            key = (row["shape"].strip(), row["texture"].strip())
            lookup[key] = {
                "manifest_index": int(row["index"]),
                "filename": row["filename"].strip(),
            }
    return lookup


# ---------------------------------------------------------------------------
# Placement templates over the (shape, texture) grid
# ---------------------------------------------------------------------------
# Each "piece" consumes a frozenset of (shape, texture) cells. We search over a
# fixed piece list (derived from the recipe assignment) with randomized
# backtracking. 18 cells -> this is effectively instantaneous.

def _full_rows(available, textures):
    """TV-k3: one shape, all textures present (a full shape row)."""
    for s in SHAPES:
        cells = frozenset((s, t) for t in textures)
        if cells <= available:
            yield cells


def _col3(available, textures):
    """SV-k3: one texture, any 3 shapes present (column segment of length 3)."""
    for t in textures:
        shapes_here = [s for s in SHAPES if (s, t) in available]
        for combo in combinations(shapes_here, 3):
            yield frozenset((s, t) for s in combo)


def _cross(available, textures):
    """k=4: 2 shapes x 2 textures, all four cells present (true 2x2)."""
    for s_pair in combinations(SHAPES, 2):
        for t_pair in combinations(textures, 2):
            cells = frozenset((s, t) for s in s_pair for t in t_pair)
            if cells <= available:
                yield cells


def _col2(available, textures):
    """SV-k2: one texture, any 2 shapes present."""
    for t in textures:
        shapes_here = [s for s in SHAPES if (s, t) in available]
        for combo in combinations(shapes_here, 2):
            yield frozenset((s, t) for s in combo)


def _row2(available, textures):
    """TV-k2: one shape, any 2 textures present."""
    for s in SHAPES:
        tex_here = [t for t in textures if (s, t) in available]
        for combo in combinations(tex_here, 2):
            yield frozenset((s, t) for t in combo)


PLACEMENT_FUNCS = {
    "full_row": _full_rows,   # TV-k3
    "col3": _col3,            # SV-k3
    "cross": _cross,          # k4 2x2
    "col2": _col2,            # SV-k2
    "row2": _row2,            # TV-k2
}


def _solve(pieces, available, textures):
    """Randomized backtracking exact-cover of the grid by the given pieces."""
    if not pieces:
        return [] if not available else None
    head, *rest = pieces
    candidates = list(PLACEMENT_FUNCS[head["kind"]](available, textures))
    random.shuffle(candidates)
    for cells in candidates:
        sub = _solve(rest, available - cells, textures)
        if sub is not None:
            return [(head, cells)] + sub
    return None


# ---------------------------------------------------------------------------
# Session design
# ---------------------------------------------------------------------------
def build_session_design(seed, manifest_path=DEFAULT_MANIFEST,
                         dropped_texture=DEFAULT_DROPPED_TEXTURE):
    random.seed(seed)
    textures = [t for t in ALL_TEXTURES if t != dropped_texture]
    assert len(textures) == 3, f"Expected 3 active textures, got {textures}"

    lookup = load_manifest(manifest_path)
    for s in SHAPES:
        for t in textures:
            assert (s, t) in lookup, f"Manifest missing ({s}, {t})"

    full_grid = frozenset((s, t) for s in SHAPES for t in textures)

    # Assign recipes A/B to the two runs (randomized which run is which).
    run_labels = [1, 2]
    recipe_of_run = dict(zip(run_labels, random.sample(["A", "B"], 2)))

    # Build the 6 pieces to place, tagged with (run, set_size, varies).
    # A: k2->shape, k3->texture ; B: k2->texture, k3->shape ; k4 always cross.
    pieces = []
    for run, recipe in recipe_of_run.items():
        if recipe == "A":
            pieces.append({"run": run, "set_size": 3, "varies": "texture", "kind": "full_row"})
            pieces.append({"run": run, "set_size": 2, "varies": "shape",   "kind": "col2"})
        else:  # B
            pieces.append({"run": run, "set_size": 3, "varies": "shape",   "kind": "col3"})
            pieces.append({"run": run, "set_size": 2, "varies": "texture", "kind": "row2"})
        pieces.append({"run": run, "set_size": 4, "varies": "both", "kind": "cross"})

    # Search order: most-constrained templates first for fast, reliable solving.
    order = {"full_row": 0, "col3": 1, "cross": 2, "col2": 3, "row2": 4}
    pieces.sort(key=lambda p: order[p["kind"]])

    solution = _solve(pieces, full_grid, textures)
    if solution is None:
        raise RuntimeError(f"No valid tiling found for seed={seed}. "
                           "This should not happen for a 6x3 grid.")

    # Assemble cell records with identity + factor metadata.
    cells = []
    for piece, cell_set in solution:
        members = sorted(cell_set, key=lambda st: (SHAPES.index(st[0]), textures.index(st[1])))
        cues = []
        for i, (shape, texture) in enumerate(members, start=1):
            info = lookup[(shape, texture)]
            cues.append({
                "cue_index": i,  # 1..k, matches in-game cue integer
                "shape": shape,
                "texture": texture,
                "manifest_index": info["manifest_index"],
                "filename": info["filename"],
            })
        rec = {
            "run": piece["run"],
            "set_size": piece["set_size"],
            "varies": piece["varies"],
            "block_type": "factorial_2x2" if piece["set_size"] == 4 else "single_dim",
            "cues": cues,
        }
        # Factor-level metadata for analysis convenience.
        shapes_in = sorted({c["shape"] for c in cues}, key=SHAPES.index)
        tex_in = sorted({c["texture"] for c in cues}, key=textures.index)
        rec["shapes"] = shapes_in
        rec["textures"] = tex_in
        cells.append(rec)

    cells.sort(key=lambda c: (c["run"], c["set_size"]))

    pool = sorted(
        [{"shape": s, "texture": t, **lookup[(s, t)]} for s in SHAPES for t in textures],
        key=lambda d: d["manifest_index"],
    )

    design = {
        "session_seed": seed,
        "dropped_texture": dropped_texture,
        "shapes": SHAPES,
        "textures": textures,
        "run_recipes": {str(r): recipe_of_run[r] for r in run_labels},
        "recipe_legend": {
            "A": "k2 varies shape, k3 varies texture",
            "B": "k2 varies texture, k3 varies shape",
            "k4": "2x2 factorial (both vary)",
        },
        "pool": pool,
        "cells": cells,
    }
    validate_design(design)
    return design


# ---------------------------------------------------------------------------
# Validation: hard-assert every invariant we care about
# ---------------------------------------------------------------------------
def validate_design(design):
    textures = design["textures"]
    cells = design["cells"]
    report = {}

    # 1. Pool is the full 6x3 cross, each combo once.
    pool_keys = [(p["shape"], p["texture"]) for p in design["pool"]]
    assert len(pool_keys) == 18, f"Pool size {len(pool_keys)} != 18"
    assert len(set(pool_keys)) == 18, "Pool has duplicate (shape,texture)"
    for s in SHAPES:
        ts = sorted(t for (sh, t) in pool_keys if sh == s)
        assert ts == sorted(textures), f"Shape {s} not crossed with all textures"
    report["pool_orthogonal_6x3"] = True

    # 2. Cells partition the 18 exactly.
    assigned = [(c["shape"], c["texture"]) for cell in cells for c in cell["cues"]]
    assert len(assigned) == 18, f"{len(assigned)} cues assigned, expected 18"
    assert set(assigned) == set(pool_keys), "Cells do not cover the pool exactly"
    assert len(set(assigned)) == 18, "An image is assigned to more than one cell"
    report["exact_partition"] = True

    # 3. Cell sizes: each run has exactly {2,3,4}.
    by_run = defaultdict(list)
    for cell in cells:
        assert len(cell["cues"]) == cell["set_size"], "Cue count != set_size"
        by_run[cell["run"]].append(cell["set_size"])
    for run, sizes in by_run.items():
        assert sorted(sizes) == [2, 3, 4], f"Run {run} sizes {sizes} != [2,3,4]"
    report["run_set_sizes_ok"] = True

    # 4. k=4 cells are genuine 2x2 crosses.
    for cell in cells:
        if cell["set_size"] == 4:
            assert len(cell["shapes"]) == 2 and len(cell["textures"]) == 2, \
                "k=4 cell is not 2 shapes x 2 textures"
            got = {(c["shape"], c["texture"]) for c in cell["cues"]}
            want = {(s, t) for s in cell["shapes"] for t in cell["textures"]}
            assert got == want, "k=4 cell is not a full 2x2 cross"
    report["k4_is_full_2x2"] = True

    # 5. k=2 / k=3 vary exactly one dimension.
    for cell in cells:
        if cell["set_size"] in (2, 3):
            n_shapes, n_tex = len(cell["shapes"]), len(cell["textures"])
            if cell["varies"] == "shape":
                assert n_tex == 1 and n_shapes == cell["set_size"], "bad shape-varying cell"
            else:
                assert n_shapes == 1 and n_tex == cell["set_size"], "bad texture-varying cell"
    report["single_dim_ok"] = True

    # 6. Within each run, k=2 and k=3 vary different dimensions (alternation).
    for run in by_run:
        dims = {cell["set_size"]: cell["varies"]
                for cell in cells if cell["run"] == run}
        assert dims[2] != dims[3], f"Run {run}: k2 and k3 vary same dimension"
    report["within_run_alternation"] = True

    # 7. Across runs, both recipes present -> shape-var and texture-var each
    #    appear once at k=2 and once at k=3.
    dim_at_size = defaultdict(list)
    for cell in cells:
        if cell["set_size"] in (2, 3):
            dim_at_size[cell["set_size"]].append(cell["varies"])
    assert sorted(dim_at_size[2]) == ["shape", "texture"], "k=2 not balanced across runs"
    assert sorted(dim_at_size[3]) == ["shape", "texture"], "k=3 not balanced across runs"
    report["cross_run_balance"] = True

    design["validation"] = report
    return report


# ---------------------------------------------------------------------------
# Human-readable rendering
# ---------------------------------------------------------------------------
def render_table(design):
    textures = design["textures"]
    lines = []
    lines.append(f"SESSION DESIGN  (seed={design['session_seed']}, "
                 f"dropped={design['dropped_texture']})")
    lines.append(f"run recipes: {design['run_recipes']}   "
                 f"[A={design['recipe_legend']['A']}; B={design['recipe_legend']['B']}]")
    lines.append("")

    # Grid view: which (run,k) cell owns each image.
    owner = {}
    for cell in design["cells"]:
        tag = f"r{cell['run']}k{cell['set_size']}"
        for c in cell["cues"]:
            owner[(c["shape"], c["texture"])] = tag

    col_w = 8
    header = "shape".ljust(10) + "".join(t.ljust(col_w) for t in textures)
    lines.append(header)
    lines.append("-" * len(header))
    for s in SHAPES:
        row = s.ljust(10) + "".join(owner[(s, t)].ljust(col_w) for t in textures)
        lines.append(row)
    lines.append("")

    # Per-cell detail.
    lines.append("CELLS")
    for cell in design["cells"]:
        vary = cell["varies"]
        kind = cell["block_type"]
        head = (f"  run {cell['run']}  k={cell['set_size']}  "
                f"varies={vary:<7}  [{kind}]")
        lines.append(head)
        for c in cell["cues"]:
            lines.append(f"      cue {c['cue_index']}: "
                         f"{c['shape']:<9} {c['texture']:<8} "
                         f"(#{c['manifest_index']:02d} {c['filename']})")
    lines.append("")
    lines.append("VALIDATION: " + ", ".join(f"{k}={v}" for k, v in design["validation"].items()))
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Group-level audit across many sessions (identity vs set-size decorrelation)
# ---------------------------------------------------------------------------
def audit_decorrelation(n_sessions, manifest_path=DEFAULT_MANIFEST,
                        dropped_texture=DEFAULT_DROPPED_TEXTURE, base_seed=0):
    """Across n_sessions seeds, tally each image's set-size occupancy. If the
    per-session banding decorrelates at the group level, every image should
    appear at all three set sizes with roughly equal frequency."""
    counts = defaultdict(Counter)
    for i in range(n_sessions):
        d = build_session_design(base_seed + i, manifest_path, dropped_texture)
        for cell in d["cells"]:
            for c in cell["cues"]:
                counts[(c["shape"], c["texture"])][cell["set_size"]] += 1

    lines = [f"DECORRELATION AUDIT over {n_sessions} sessions",
             "(each image's share of appearances at k=2 / k=3 / k=4)",
             ""]
    worst = 0.0
    for s in SHAPES:
        for t in [x for x in ALL_TEXTURES if x != dropped_texture]:
            c = counts[(s, t)]
            tot = sum(c.values())
            frac = {k: c[k] / tot for k in SET_SIZES}
            # deviation from perfectly uniform (1/3 each)
            dev = max(abs(frac[k] - 1/3) for k in SET_SIZES)
            worst = max(worst, dev)
            lines.append(f"  {s:<9} {t:<8}  "
                         f"k2={frac[2]:.2f} k3={frac[3]:.2f} k4={frac[4]:.2f}")
    lines.append("")
    lines.append(f"max deviation from uniform (1/3) across all images: {worst:.3f}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Generate one River Raid session cue-identity design.")
    ap.add_argument("--seed", type=int, default=0, help="Session seed (controls image->cell assignment).")
    ap.add_argument("--manifest", default=DEFAULT_MANIFEST, help="Path to stimulus manifest.csv.")
    ap.add_argument("--dropped-texture", default=DEFAULT_DROPPED_TEXTURE, choices=ALL_TEXTURES)
    ap.add_argument("--out", default=None, help="Write design JSON to this path.")
    ap.add_argument("--audit", type=int, default=0, help="Run group-level decorrelation audit over N sessions.")
    args = ap.parse_args()

    design = build_session_design(args.seed, args.manifest, args.dropped_texture)
    print(render_table(design))

    if args.out:
        with open(args.out, "w") as f:
            json.dump(design, f, indent=2)
        print(f"\nWrote design JSON -> {args.out}")

    if args.audit:
        print("\n" + audit_decorrelation(args.audit, args.manifest, args.dropped_texture))


if __name__ == "__main__":
    main()
