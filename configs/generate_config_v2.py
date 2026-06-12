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

# NEW: Valid orderings of the 4 shuffled slots where I1 and TI1 are never adjacent
VALID_SLOT_ORDERS = [
    ('T', 'I1', 'TI2', 'TI1'),
    ('T', 'TI1', 'TI2', 'I1'),
    ('I1', 'T', 'TI1', 'TI2'),
    ('I1', 'T', 'TI2', 'TI1'),
    ('I1', 'TI2', 'T', 'TI1'),
    ('I1', 'TI2', 'TI1', 'T'),
    ('TI1', 'T', 'I1', 'TI2'),
    ('TI1', 'T', 'TI2', 'I1'),
    ('TI1', 'TI2', 'T', 'I1'),
    ('TI1', 'TI2', 'I1', 'T'),
    ('TI2', 'I1', 'T', 'TI1'),
    ('TI2', 'TI1', 'T', 'I1'),
]

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

# NEW: builds a single slot's blocks for one task and one run
def make_slot(name, run, orders, theme, ntrials_per_cue, scenes, paired_with=None):
    """
    Build a list of experimental blocks for one slot (one task, one run).
    If paired_with is provided, targets copies ncues from instrumental orders.
    """
    slot = []
    if name == 'targets' and paired_with is not None:
        # targets copies ncues from instrumental orders to keep them matched
        inst_orders = paired_with
        for (ncues, scene_index) in zip(*inst_orders):
            slot.append({
                "name": "targets",
                "ncues": ncues,
                "is_practice": False,
                "ntrials_per_cue": ntrials_per_cue,
                "theme": theme,
                "instructions": instructions["targets"],
                "scene": random.choice(scenes)
            })
    else:
        cur_order = orders[name][run]
        for (ncues, scene_index) in zip(*cur_order):
            slot.append({
                "name": name,
                "ncues": ncues,
                "is_practice": False,
                "ntrials_per_cue": ntrials_per_cue,
                "theme": theme,
                "instructions": instructions[name],
                "scene": scenes[scene_index]
            })
    return slot

# NEW: builds a single practice block for a task
def make_practice(task, scenes, theme=""):
    """Build a single practice block for a task."""
    return {
        "name": task,
        "ncues": 2 if task == "targets" else min(tasks[task]),
        "is_practice": True,
        "ntrials_per_cue": 50,
        "theme": "training",
        "instructions": instructions[task],
        "scene": random.choice(scenes)
    }

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

# NEW: completely restructured generate_blocks function
def generate_blocks(task_names, themes, ntrials_per_cue=10, nrepeats_per_cycle=2, scenes=SCENES):
    all_blocks = []
    pair_targets_instrumental = "targets" in task_names and "instrumental" in task_names

    orders = get_cue_and_theme_orders(task_names, nrepeats_per_cycle, scenes)

    # NEW: shuffle themes randomly before assigning
    themes_shuffled = random.sample(themes, len(themes))

    # NEW: randomly decide which run is shared vs unique
    shared_run = random.choice([0, 1])

    # NEW: shared run uses one theme for all tasks
    shared_theme = themes_shuffled[0]

    # NEW: unique run uses separate themes per task
    targets_unique_theme = themes_shuffled[1]
    instrumental_unique_theme = themes_shuffled[2]
    ti_unique_theme = themes_shuffled[3]

    # NEW: helper to get the correct theme for a task and run
    def get_theme(task, run):
        if run == shared_run:
            return shared_theme
        else:
            if task == 'targets':
                return targets_unique_theme
            elif task == 'instrumental':
                return instrumental_unique_theme
            else:
                return ti_unique_theme

    # NEW: build all 6 slots independently
    slots = {}

    if pair_targets_instrumental:
        for run in range(nrepeats_per_cycle):
            inst_orders = orders["instrumental"][run]

            # Build instrumental slot
            slots[f'I{run+1}'] = make_slot(
                'instrumental', run, orders,
                get_theme('instrumental', run),
                ntrials_per_cue, scenes
            )

            # Build targets slot — copies ncues from instrumental
            slots[f'T{run+1}'] = make_slot(
                'targets', run, orders,
                get_theme('targets', run),
                ntrials_per_cue, scenes,
                paired_with=inst_orders
            )

    if 'targets-instrumental' in task_names:
        for run in range(nrepeats_per_cycle):
            slots[f'TI{run+1}'] = make_slot(
                'targets-instrumental', run, orders,
                get_theme('targets-instrumental', run),
                ntrials_per_cue, scenes
            )

    # NEW: first two slots are always opposite runs of targets and instrumental
    first_pair_option = random.choice([
        ['T1', 'I2'],  # targets run 1 first, instrumental run 2 second
        ['I1', 'T2'],  # instrumental run 1 first, targets run 2 second
    ])

    # NEW: remaining 4 slots depend on which option was chosen
    if first_pair_option == ['T1', 'I2']:
        remaining_keys = ['T2', 'I1', 'TI1', 'TI2']
    else:
        remaining_keys = ['T1', 'I2', 'TI1', 'TI2']

    # NEW: pick a valid ordering for the remaining 4 slots
    slot_order_template = random.choice(VALID_SLOT_ORDERS)

    # NEW: map template placeholders to actual slot keys
    placeholder_map = {
        'T': remaining_keys[0],   # targets leftover
        'I1': remaining_keys[1],  # instrumental leftover
        'TI1': 'TI1',
        'TI2': 'TI2'
    }
    remaining_order = [placeholder_map[s] for s in slot_order_template]

    final_order = first_pair_option + remaining_order

    # NEW: assemble blocks with practice prepended to first occurrence of each task
    practice_added = set()

    for slot_key in final_order:
        # Determine task name from slot key
        if slot_key.startswith('TI'):
            task = 'targets-instrumental'
        elif slot_key.startswith('T'):
            task = 'targets'
        else:
            task = 'instrumental'

        # Add practice block before first occurrence of each task
        if task not in practice_added:
            all_blocks.append(make_practice(task, scenes))
            practice_added.add(task)

        # Add the slot's blocks
        all_blocks.extend(slots[slot_key])

    # NEW: return blocks and theme_info for logging
    theme_info = {
        'shared_run': shared_run + 1,  # 1-indexed for readability
        'shared_theme': shared_theme,
        'targets_unique_theme': targets_unique_theme,
        'instrumental_unique_theme': instrumental_unique_theme,
        'ti_unique_theme': ti_unique_theme,
        'slot_order': final_order
    }

    return all_blocks, theme_info

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate randomized experiment blocks.")
    parser.add_argument("themes", nargs="+", help="List of themes to cycle through (e.g., animals space shapes)")
    parser.add_argument("--tasks", nargs="+", help="names of tasks to cycle through", default=DEFAULT_TASKS)
    parser.add_argument("--output", "-o", default="blocks.json", help="Output JSON file")
    parser.add_argument("--ntrials_per_cue", type=int, default=10, help="Number of trials for each cue")
    parser.add_argument("--nrepeats_per_cycle", type=int, default=2, help="Number of times to repeat each task cycle")
    parser.add_argument("--end_probe_task", type=str, default=None,
                        help="Task to add as end probe block (e.g. 'targets')")
    parser.add_argument("--end_probe_ncues", type=int, default=1,
                        help="Number of cues for end probe block")
    parser.add_argument("--end_probe_ntrials", type=int, default=30,
                        help="Number of trials per cue for end probe block")
    parser.add_argument("--scenes", nargs="+", default=["grass", "river"])

    args = parser.parse_args()
    blocks, theme_info = generate_blocks(
        args.tasks, args.themes, args.ntrials_per_cue,
        args.nrepeats_per_cycle, args.scenes
    )

    if args.end_probe_task:
        probe = make_end_probe(args.end_probe_task, args.end_probe_ncues, args.end_probe_ntrials, SCENES)
        blocks.append(probe)

    # NEW: output includes theme_info for analysis logging
    output = {
        'theme_info': theme_info,
        'blocks': blocks
    }

    with open(args.output, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Generated {len(blocks)} blocks → saved to {args.output}")
    print(f"Shared run: {theme_info['shared_run']}, shared theme: {theme_info['shared_theme']}")
    print(f"Slot order: {theme_info['slot_order']}")

    # Write blocks as flat list (for the game)
    with open(args.output, "w") as f:
        json.dump(blocks, f, indent=2)

    # Write theme_info to a separate log file
    theme_info_path = args.output.replace('.json', '_theme_info.json')
    with open(theme_info_path, "w") as f:
        json.dump(theme_info, f, indent=2)

    print(f"Generated {len(blocks)} blocks → saved to {args.output}")
    print(f"Theme info → saved to {theme_info_path}")
    print(f"Shared run: {theme_info['shared_run']}, shared theme: {theme_info['shared_theme']}")
    print(f"Slot order: {theme_info['slot_order']}")