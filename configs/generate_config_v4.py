#!/usr/bin/env python3
"""
generate_config_v4.py
======================

Reads a FROZEN session-design JSON (produced by session_design.py) and emits one
per-session block list for the River Raid game, plus an ordering-report sidecar.

WHAT CHANGED FROM v3
--------------------
- v3 assigned versioned spritesheet "themes" (abstract_1_v1 ...) to slots and the
  game recovered cue identity implicitly via theme + themeOffsets[ncues] arithmetic.
- v4 carries cue identity EXPLICITLY. Each emitted block has a `cues` array in which
  every cue is tagged with shape / texture / manifest_index / filename. There is no
  `theme` / `theme_offset`. The whole v3 theme machinery (assign_themes_to_slots,
  VALID_SLOT_ORDERS, base-theme adjacency) is gone: it only existed to keep the same
  theme out of adjacent I->TI blocks, and with one shared 18-image pool that hazard
  no longer exists.
- Identity is frozen upstream in the design JSON; this script only randomizes ORDER
  (slot order, which occurrence of a task is run 1 vs run 2, and sub-block order
  within a slot).

DESIGN -> GAME MAPPING
----------------------
design run 1  -> slots T1, I1, TI1        design run 2 -> slots T2, I2, TI2
The SAME cell (same images, same cue_index) is stamped into all three tasks, so
every cue appears under every task rule (T, I, TI).

SESSION ORDERING RULES
----------------------
Session 1 : first slot in {T, I}; first TI only after >=1 T AND >=1 I have appeared;
            no two adjacent slots share a task type.
Session 2,3: unconstrained uniform random permutation of the six slots
            (unless --interleave-all is passed, which enforces no-back-to-back for
             all sessions; the session-1 rules always apply to session 1).

Practice: the 2-cue training block is glued immediately before its own slot. The
no-back-to-back rule concerns the six NON-practice slots only.

NOTE: the reward matrix R (cue->button map for I/TI) is still generated in-game per
block by randomR() in experiment.js. That is unchanged here and out of scope for the
cue-identity work; R is already recoverable from the block log.

Example
-------
  python session_design.py --seed 11 --out design_s1.json
  python session_design.py --seed 22 --out design_s2.json
  python session_design.py --seed 33 --out design_s3.json
  python generate_config_v4.py --design design_s1.json --session-index 1 -o CONFIG_s1.json
  python generate_config_v4.py --design design_s2.json --session-index 2 -o CONFIG_s2.json
  python generate_config_v4.py --design design_s3.json --session-index 3 -o CONFIG_s3.json
"""

import json
import random
import argparse
from collections import defaultdict

TASK_FULL = {
    "T": "targets",
    "I": "instrumental",
    "TI": "targets-instrumental",
}
INSTRUCTIONS = {
    "targets": "control the airplane with the joystick\nfly underneath each image to destroy it",
    "instrumental": "figure out which button will destroy each image",
    "targets-instrumental": "control the airplane with the joystick\nfigure out which button will destroy each image",
}
TASK_TOKENS = ["T", "T", "I", "I", "TI", "TI"]
DEFAULT_SCENE = "river"
DEFAULT_TRAINING_IMAGES = ["training-1.png", "training-2.png"]


# ---------------------------------------------------------------------------
# Ordering
# ---------------------------------------------------------------------------
def _no_back_to_back(seq):
    return all(seq[i] != seq[i + 1] for i in range(len(seq) - 1))


def _first_is_pure(seq):
    return seq[0] in ("T", "I")


def _ti_after_both_pure(seq):
    """First TI must be preceded by at least one T and one I."""
    j = seq.index("TI")
    prefix = set(seq[:j])
    return "T" in prefix and "I" in prefix


def sample_slot_order(session_index, interleave_all=False, max_attempts=100000):
    """Return a length-6 list of task tokens satisfying this session's rules."""
    for _ in range(max_attempts):
        seq = TASK_TOKENS[:]
        random.shuffle(seq)
        if session_index == 1:
            if _first_is_pure(seq) and _ti_after_both_pure(seq) and _no_back_to_back(seq):
                return seq
        else:
            if interleave_all and not _no_back_to_back(seq):
                continue
            return seq
    raise RuntimeError(f"Could not sample a valid slot order for session {session_index}")


def assign_runs(slot_tokens):
    """Turn a token sequence (e.g. ['T','I','TI',...]) into run-labeled slots.
    Each task's two occurrences get run labels 1 and 2 in random order
    (inter-run order is free). Returns list of dicts {task, run, order_pos}."""
    run_choices = {tok: random.sample([1, 2], 2) for tok in ("T", "I", "TI")}
    counters = defaultdict(int)
    slots = []
    for pos, tok in enumerate(slot_tokens):
        run = run_choices[tok][counters[tok]]
        counters[tok] += 1
        slots.append({"task": TASK_FULL[tok], "token": tok, "run": run, "order_pos": pos})
    return slots


# ---------------------------------------------------------------------------
# Block construction from the frozen design
# ---------------------------------------------------------------------------
def load_design(path):
    with open(path) as f:
        design = json.load(f)
    cells_by_run = defaultdict(dict)  # run -> {set_size: cell}
    for cell in design["cells"]:
        cells_by_run[cell["run"]][cell["set_size"]] = cell
    return design, cells_by_run


def make_practice_block(task, training_images, ntrials_practice):
    cues = [
        {"cue_index": i + 1, "shape": "training", "texture": None,
         "manifest_index": None, "filename": fn, "training": True}
        for i, fn in enumerate(training_images[:2])
    ]
    return {
        "name": task,
        "ncues": len(cues),
        "is_practice": True,
        "ntrials_per_cue": ntrials_practice,
        "instructions": INSTRUCTIONS[task],
        "scene": DEFAULT_SCENE,
        "run": None,
        "set_size": len(cues),
        "varies": None,
        "block_type": "practice",
        "cues": cues,
    }


def make_task_block(task, cell, ntrials_per_cue):
    # Copy the frozen cue identities verbatim; only the task rule differs.
    cues = [dict(c) for c in cell["cues"]]
    return {
        "name": task,
        "ncues": cell["set_size"],
        "is_practice": False,
        "ntrials_per_cue": ntrials_per_cue,
        "instructions": INSTRUCTIONS[task],
        "scene": DEFAULT_SCENE,
        "run": cell["run"],
        "set_size": cell["set_size"],
        "varies": cell["varies"],
        "block_type": cell["block_type"],
        "cues": cues,
    }


def build_config(design_path, session_index, seed=None,
                 ntrials_per_cue=10, ntrials_per_cue_targets=None,
                 ntrials_practice=50, training_images=None,
                 interleave_all=False):
    if seed is not None:
        random.seed(seed)
    training_images = training_images or DEFAULT_TRAINING_IMAGES
    ntrials_targets = ntrials_per_cue_targets if ntrials_per_cue_targets is not None else ntrials_per_cue

    design, cells_by_run = load_design(design_path)

    slot_tokens = sample_slot_order(session_index, interleave_all)
    slots = assign_runs(slot_tokens)

    blocks = []
    order_report = []
    for slot in slots:
        task, run = slot["task"], slot["run"]
        # Practice glued in front of its slot.
        blocks.append(make_practice_block(task, training_images, ntrials_practice))

        # Sub-block (set-size) order within the slot is shuffled.
        set_sizes = sorted(cells_by_run[run].keys())  # [2,3,4]
        random.shuffle(set_sizes)

        sub = []
        for k in set_sizes:
            cell = cells_by_run[run][k]
            nt = ntrials_targets if task == "targets" else ntrials_per_cue
            blocks.append(make_task_block(task, cell, nt))
            sub.append({"set_size": k, "varies": cell["varies"],
                        "block_type": cell["block_type"]})
        order_report.append({
            "slot_position": slot["order_pos"],
            "task": task, "token": slot["token"], "run": run,
            "sub_block_order": sub,
        })

    info = {
        "session_index": session_index,
        "design_source": design_path,
        "design_seed": design.get("session_seed"),
        "dropped_texture": design.get("dropped_texture"),
        "slot_token_order": slot_tokens,
        "interleave_all": interleave_all,
        "slots": order_report,
    }
    return blocks, info


def render_order_report(info):
    lines = [f"SESSION {info['session_index']}  "
             f"(design seed={info['design_seed']}, source={info['design_source']})",
             f"slot task order: {' -> '.join(info['slot_token_order'])}",
             ""]
    for s in info["slots"]:
        subs = ", ".join(f"k{d['set_size']}({d['varies']})" for d in s["sub_block_order"])
        lines.append(f"  slot {s['slot_position']}: "
                     f"{s['task']:<22} run {s['run']}   [{subs}]")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Generate a per-session River Raid config from a frozen design JSON.")
    ap.add_argument("--design", required=True, help="Path to frozen session-design JSON.")
    ap.add_argument("--session-index", type=int, required=True, choices=[1, 2, 3])
    ap.add_argument("--output", "-o", default="config.json")
    ap.add_argument("--seed", type=int, default=None, help="RNG seed for ORDER randomization (not identity).")
    ap.add_argument("--ntrials_per_cue", type=int, default=10)
    ap.add_argument("--ntrials_per_cue_targets", type=int, default=None)
    ap.add_argument("--ntrials_practice", type=int, default=50)
    ap.add_argument("--training-images", nargs=2, default=None)
    ap.add_argument("--allow-back-to-back", action="store_true",
                    help="Disable no-back-to-back for sessions 2 & 3 (session 1 rules always apply). "
                         "Default: interleaving is enforced for all three sessions.")
    args = ap.parse_args()

    blocks, info = build_config(
        args.design, args.session_index, seed=args.seed,
        ntrials_per_cue=args.ntrials_per_cue,
        ntrials_per_cue_targets=args.ntrials_per_cue_targets,
        ntrials_practice=args.ntrials_practice,
        training_images=args.training_images,
        interleave_all=not args.allow_back_to_back,
    )

    with open(args.output, "w") as f:
        json.dump(blocks, f, indent=2)
    info_path = args.output.replace(".json", "_order_info.json")
    with open(info_path, "w") as f:
        json.dump(info, f, indent=2)

    print(render_order_report(info))
    print(f"\nGenerated {len(blocks)} blocks -> {args.output}")
    print(f"Order info -> {info_path}")


if __name__ == "__main__":
    main()
