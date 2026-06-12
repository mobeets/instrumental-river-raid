import json
import random
import numpy as np
import argparse
from itertools import cycle

tasks = {
    "targets": [3],
    "instrumental": [2, 3, 4],
    "targets-instrumental": [2, 3, 4],
    "locations": [3],
    "locations-instrumental": [2, 3, 4, 5]
}
instructions = {
    "targets": "control the airplane with the joystick\nfly underneath each image to destroy it",
    "instrumental": "figure out which button will destroy each image",
    "targets-instrumental": "control the airplane with the joystick\nfigure out which button will destroy each image",
    "locations": "control an airplane with the joystick\ndestroy each block by shooting the marked location",
    "locations-instrumental": "control an airplane with the joystick\nfigure out which location will destroy each block"
}
DEFAULT_TASKS = ["targets", "instrumental", "targets-instrumental"]
SCENES = ["grass", "river"]

def make_orders(ncues_list, scenes):
    ncues_list = list(ncues_list)
    scenes = list(scenes)

    n_conditions = len(ncues_list)
    n_scenes = len(scenes)

    # scene_orders: each row is 0..n_scenes-1 shuffled
    scene_orders = np.vstack([
        np.random.permutation(n_scenes)
        for _ in range(n_conditions)
    ])

    # cue_orders: each row is a permutation of ncues_list
    cue_orders = np.vstack([
        np.random.permutation(ncues_list)
        for _ in range(n_scenes)
    ]).T

    return scene_orders, cue_orders

def get_cue_and_theme_orders(task_names, nrepeats_per_cycle, scenes):
    assert len(scenes) == nrepeats_per_cycle, "must have one scene per cycle repeat for balancing"

    assignments = {}
    for task in task_names:
        ncues_list = tasks[task][:]
        scene_orders, cue_orders = make_orders(ncues_list, scenes)

        assignments[task] = []
        for i in range(nrepeats_per_cycle):
            assignments[task].append((cue_orders[:,i].tolist(), scene_orders[:,i].tolist()))
    return assignments

def generate_blocks(task_names, themes, ntrials_per_cue=10, nrepeats_per_cycle=2, scenes=SCENES):
    # Tasks and ncues specification
    all_blocks = []
    pair_targets_instrumental = "targets" in task_names and "instrumental" in task_names

    # Shuffle themes so each (run, task) gets one theme
    theme_iterator = cycle(themes)

    orders = get_cue_and_theme_orders(task_names, nrepeats_per_cycle, scenes)

    for run in range(nrepeats_per_cycle):
        run_blocks = []  # collect this run's blocks before shuffling

        if pair_targets_instrumental:
            # Draw one shared theme for both targets and instrumental this run
            theme = next(theme_iterator)

            # Get the pre-randomized ncues and scene assignments for instrumental this run
            inst_orders = orders["instrumental"][run]

            # List to hold the paired blocks before shuffling
            paired = []

            # ---- ADD PRACTICE BLOCKS (RUN 1 ONLY) ----
            if run == 0:
                for practice_task in ["targets", "instrumental"]:
                    practice_ncues = min(tasks[practice_task])
                    practice_scene = random.choice(scenes)
                    practice_block = {
                        "name": practice_task,
                        "ncues": practice_ncues,
                        "is_practice": True,
                        "ntrials_per_cue": 50,
                        "theme": "training" if practice_task == "instrumental" else "",
                        "instructions": instructions[practice_task],
                        "scene": practice_scene
                    }
                    all_blocks.append(practice_block)

            # Loop over each (ncues, scene) combination for instrumental this run
            for (ncues, scene_index) in zip(*inst_orders):
                scene = scenes[scene_index]

                # Create the instrumental block
                paired.append({
                    "name": "instrumental",
                    "ncues": ncues,
                    "is_practice": False,
                    "ntrials_per_cue": ntrials_per_cue,
                    "theme": theme,
                    "instructions": instructions["instrumental"],
                    "scene": scene
                })

                # Create the matching targets block — same theme and ncues as instrumental
                paired.append({
                    "name": "targets",
                    "ncues": ncues,
                    "is_practice": False,
                    "ntrials_per_cue": ntrials_per_cue,
                    "theme": theme,
                    "instructions": instructions["targets"],
                    "scene": random.choice(scenes)
                })

            # Shuffle so targets and instrumental are interleaved randomly
            random.shuffle(paired)

            # Add this run's paired blocks to run_blocks
            run_blocks.extend(paired)

        for task in task_names:
            # Skip targets and instrumental — handled by paired logic above
            if pair_targets_instrumental and task in ["targets", "instrumental"]:
                continue

            # Assign theme for this task  # ADDED
            if task not in ["locations"]:  # ADDED
                theme = next(theme_iterator)  # ADDED
            else:  # ADDED
                theme = ""  # ADDED

            # ---- ADD PRACTICE BLOCK (RUN 1 ONLY) ----
            if run == 0:
                practice_ncues = min(tasks[task])
                practice_scene = random.choice(scenes)

                practice_block = {
                    "name": task,
                    "ncues": practice_ncues,
                    "is_practice": True,
                    "ntrials_per_cue": 50,
                    "theme": "training" if task not in ["locations"] else "",
                    "instructions": instructions[task],
                    "scene": practice_scene
                }
                all_blocks.append(practice_block)

            # ---- ADD EXPERIMENTAL BLOCKS ----
            mini_block_index = 0

            cur_order = orders[task][run]
            for (ncues, scene_index) in zip(*cur_order):
                block = {
                    "name": task,
                    "ncues": ncues,
                    "is_practice": False,
                    "ntrials_per_cue": ntrials_per_cue,
                    "theme": theme,
                    "instructions": instructions[task],
                    "scene": scenes[scene_index]
                }
                all_blocks.append(block)
                mini_block_index += 1

        # After all tasks processed, add run_blocks to all_blocks
        all_blocks.extend(run_blocks)

    return all_blocks

def make_end_probe(task, ncues, ntrials, scenes):
    return {
        "name": task,
        "ncues": ncues,
        "is_practice": False,
        "ntrials_per_cue": ntrials,
        "theme": "" if task in ["locations"] else "training",
        "instructions": instructions[task],
        "scene": random.choice(scenes)
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate randomized experiment blocks.")
    parser.add_argument("themes", nargs="+", help="List of themes to cycle through (e.g., animals space shapes)")
    parser.add_argument("--tasks", nargs="+", help="names of tasks to cycle through", default=DEFAULT_TASKS)
    parser.add_argument("--output", "-o", default="blocks.json", help="Output JSON file")
    parser.add_argument("--ntrials_per_cue", type=int, default=10, help="Number of trials for each cue")
    parser.add_argument("--nrepeats_per_cycle", type=int, default=2, help="Number of times to repeat each task cycle")
    parser.add_argument("--end_probe_task", type=str,default=None,
                        help="Task to add as end probe block (e.g. 'targets')")
    parser.add_argument("--end_probe_ncues", type=int, default=1,
                    help="Number of cues for end probe block")
    parser.add_argument("--end_probe_ntrials", type=int, default=30,
                        help="Number of trials per cue for end probe block")
    parser.add_argument("--scenes", nargs="+", default=["grass", "river"])

    args = parser.parse_args()
    blocks = generate_blocks(args.tasks, args.themes, args.ntrials_per_cue, args.nrepeats_per_cycle, args.scenes)

    if args.end_probe_task:
        probe = make_end_probe(args.end_probe_task, args.end_probe_ncues, args.end_probe_ntrials, SCENES)
        blocks.append(probe)

    with open(args.output, "w") as f:
        json.dump(blocks, f, indent=2)

    print(f"Generated {len(blocks)} blocks → saved to {args.output}")
