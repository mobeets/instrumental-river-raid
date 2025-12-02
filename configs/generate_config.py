import json
import random
import argparse
from itertools import cycle

def generate_blocks(themes):
    # Tasks and ncues specification
    tasks = {
        "targets": [3],
        "instrumental": [2, 3, 4, 5],
        "targets-instrumental": [2, 3, 4, 5]
    }
    scenes = ["grass", "river"]
    all_blocks = []

    # Shuffle themes so each (run, task) gets one theme
    theme_iterator = cycle(themes)

    # Two runs total
    for run in [1, 2]:
        # Task order (you can shuffle this if you want)
        run_tasks = list(tasks.keys())
        # random.shuffle(run_tasks)

        for task in run_tasks:

            # Copy and shuffle ncues for this task
            ncues_list = tasks[task][:]
            random.shuffle(ncues_list)

            # Assign one theme for all blocks in this (run, task)
            if task != "targets":
                theme = next(theme_iterator)
            else:
                theme = ""

            # Scene assignment for the *experimental* blocks
            scene_assignments = scenes * ((len(ncues_list) + 1) // 2)
            scene_assignments = scene_assignments[:len(ncues_list)]
            random.shuffle(scene_assignments)

            # ---- ADD PRACTICE BLOCK (RUN 1 ONLY) ----
            if run == 1:
                practice_ncues = min(tasks[task])
                practice_scene = random.choice(scenes)  # can randomize or enforce balancing if needed

                practice_block = {
                    "name": task,
                    "ncues": practice_ncues,
                    "is_practice": True,
                    "ntrials_per_cue": 3,
                    "theme": "training" if task != "targets" else "",
                    "scene": practice_scene
                }
                all_blocks.append(practice_block)

            # ---- ADD EXPERIMENTAL BLOCKS ----
            for ncues, scene in zip(ncues_list, scene_assignments):
                block = {
                    "name": task,
                    "ncues": ncues,
                    "is_practice": False,
                    "ntrials_per_cue": 10,
                    "theme": theme,
                    "scene": scene
                }
                all_blocks.append(block)

    return all_blocks

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate randomized experiment blocks.")
    parser.add_argument("themes", nargs="+", help="List of themes to cycle through (e.g., animals space shapes)")
    parser.add_argument("--output", "-o", default="blocks.json", help="Output JSON file")

    args = parser.parse_args()

    blocks = generate_blocks(args.themes)

    with open(args.output, "w") as f:
        json.dump(blocks, f, indent=2)

    print(f"Generated {len(blocks)} blocks → saved to {args.output}")
