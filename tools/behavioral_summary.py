#!/usr/bin/env python3
"""
behavioral_summary.py -- sanity check + percent-correct plot from River Raid logs.

Reads one or more session .jsonl logs, pools NON-practice trials, and computes
percent correct by (task, set size), then prints a sanity-check summary and saves
a plot (percent correct vs number of cues, one series per task) like the standard
YFX figure.

Correctness definition (current build): a trial is CORRECT iff it ends in
`cue offset - hit`; every other `cue offset - *` (offscreen variants, collision)
is incorrect. Successful destroys in all three tasks log as `- hit`.

Usage:
    python behavioral_summary.py logs/YFZ_run02.jsonl
    python behavioral_summary.py logs/s1.jsonl logs/s2.jsonl logs/s3.jsonl -o YFZ_combined.png
"""

import sys, json, argparse
from collections import defaultdict, Counter
from math import sqrt
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

TASK_ORDER = ["targets", "instrumental", "targets-instrumental"]
TASK_LABEL = {
    "targets": "Targets",
    "instrumental": "Instrumental",
    "targets-instrumental": "Targets + Instrumental",
}
TASK_COLOR = {
    "targets": "#1f77b4",
    "instrumental": "#ff7f0e",
    "targets-instrumental": "#2ca02c",
}
TASK_JITTER = {"targets": -0.07, "instrumental": 0.0, "targets-instrumental": 0.07}


def iter_records(path):
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                o = json.loads(line)
            except json.JSONDecodeError:
                continue
            if o.get("type") == "batch":
                for e in o.get("events", []):
                    yield e.get("type"), e.get("payload", {})
            else:
                yield o.get("type"), o.get("payload", {})


def collect(paths):
    # (task, set_size) -> [n_trials, n_hits]; plus miss-type + collision tallies
    groups = defaultdict(lambda: [0, 0])
    miss_types = Counter()
    collisions = 0
    for path in paths:
        blocks = {}
        for typ, p in iter_records(path):
            if typ == "start of TrialBlock":
                blocks[p["block_index"]] = {
                    "name": p.get("name"),
                    "is_practice": p.get("is_practice"),
                    "set_size": p.get("set_size", p.get("ncues")),
                }
            elif typ == "Trial event":
                name = p.get("name", "")
                if not name.startswith("cue offset"):
                    continue
                blk = blocks.get(p.get("block_index"))
                if blk is None or blk["is_practice"]:
                    continue
                key = (blk["name"], blk["set_size"])
                groups[key][0] += 1
                if name.startswith("cue offset - hit"):
                    groups[key][1] += 1
                else:
                    miss_types[name] += 1
                    if "collision" in name:
                        collisions += 1
    return groups, miss_types, collisions


def summarize(groups, miss_types, collisions, subject, n_sessions):
    print(f"=== Behavioral sanity check: {subject}, {n_sessions} session(s) ===\n")
    total = sum(v[0] for v in groups.values())
    hits = sum(v[1] for v in groups.values())
    print(
        f"Non-practice trials: {total}   overall hit rate: "
        f"{(hits / total if total else 0):.3f}\n"
    )
    print(f"{'task':<24} {'k':>2} {'n':>5} {'%corr':>7} {'SE':>6}")
    warnings = []
    for task in TASK_ORDER:
        sizes = sorted(k[1] for k in groups if k[0] == task)
        for k in sizes:
            n, h = groups[(task, k)]
            p = h / n if n else float("nan")
            se = sqrt(p * (1 - p) / n) if n else float("nan")
            print(f"{task:<24} {k:>2} {n:>5} {p:>7.3f} {se:>6.3f}")
            if n < 8:
                warnings.append(
                    f"  - {task} k={k}: only {n} trials (thin; error bars unreliable)"
                )
    print("\nMiss-type breakdown:")
    for name, c in miss_types.most_common():
        print(f"  {c:4d}  {name}")
    if collisions:
        warnings.append(
            f"  - {collisions} 'collision' outcomes seen; counted as INCORRECT "
            "(the docs are ambiguous -- confirm this is what you want)."
        )
    # basic sanity flags
    for task in TASK_ORDER:
        present = {k[1] for k in groups if k[0] == task}
        missing = {2, 3, 4} - present
        if missing:
            warnings.append(f"  - {task}: no trials at set size(s) {sorted(missing)}")
    if warnings:
        print("\n[!] Sanity flags:")
        print("\n".join(warnings))
    else:
        print(
            "\n[ok] No sanity flags -- all task x set-size cells populated with >=8 trials."
        )
    print()


def plot(groups, subject, title_suffix, out):
    fig, ax = plt.subplots(figsize=(6, 6))
    for task in TASK_ORDER:
        sizes = sorted(k[1] for k in groups if k[0] == task)
        xs, ys, es = [], [], []
        for k in sizes:
            n, h = groups[(task, k)]
            if not n:
                continue
            p = h / n
            xs.append(k + TASK_JITTER[task])
            ys.append(p)
            es.append(sqrt(p * (1 - p) / n))
        if xs:
            ax.errorbar(
                xs,
                ys,
                yerr=es,
                fmt="o",
                ms=8,
                capsize=3,
                color=TASK_COLOR[task],
                label=TASK_LABEL[task],
            )
    ax.set_xlabel("Number of cues")
    ax.set_ylabel("Percent correct")
    ax.set_ylim(0, 1.0)
    all_sizes = sorted({k[1] for k in groups})
    ax.set_xticks(all_sizes)
    ax.set_xlim(
        min(all_sizes) - 0.5, max(all_sizes) + 0.5
    )  # pad so end points aren't clipped
    ax.set_title(f"{subject}, {title_suffix}")
    ax.legend(loc="lower left", frameon=True)
    fig.tight_layout()
    fig.savefig(out, dpi=130)
    print(f"Saved plot -> {out}")


def main():
    ap = argparse.ArgumentParser(
        description="Behavioral summary + percent-correct plot."
    )
    ap.add_argument("logs", nargs="+", help="One or more session .jsonl logs (pooled).")
    ap.add_argument("-o", "--out", default="behavioral_summary.png")
    ap.add_argument(
        "--subject",
        default=None,
        help="Override subject label (else inferred from filename).",
    )
    ap.add_argument(
        "--session",
        default=None,
        help="Session label for the title, e.g. '1' -> 'session 1'. "
        "Default: 'session 1' for a single log, 'sessions 1-N' for N logs.",
    )
    args = ap.parse_args()

    subject = args.subject or (args.logs[0].split("/")[-1].split("-")[0])
    n = len(args.logs)
    if args.session is not None:
        title_suffix = f"session {args.session}"
    else:
        title_suffix = "session 1" if n == 1 else f"sessions 1–{n}"
    groups, miss_types, collisions = collect(args.logs)
    summarize(groups, miss_types, collisions, subject, n)
    if any(v[0] for v in groups.values()):
        plot(groups, subject, title_suffix, args.out)
    else:
        print("No non-practice trials found -- nothing to plot.")


if __name__ == "__main__":
    main()
