"""
generate_config_v3.py

Example usage:

python configs/generate_config_v3.py \
  --base_themes abstract_1 abstract_2 \
  --ntrials_per_cue 10 \
  --ntrials_per_cue_targets 10 \
  --output configs/YFY_experiment_run01.json

DIFFERENCES FROM v2:
--------------------
1. THEME SYSTEM COMPLETELY REPLACED:
   - v2 used a shared/unique theme structure: one theme shared across all tasks for one run,
     and separate unique themes per task for the other run. This required 4 themes total
     (shared_theme, targets_unique_theme, instrumental_unique_theme, ti_unique_theme).
   - v3 uses versioned themes: exactly 2 base image sets (e.g. abstract_1, abstract_2),
     each with 3 shuffled versions (v1, v2, v3), giving 6 versioned themes total.
     Each of the 6 slots gets exactly one unique versioned theme. No theme is reused.

2. COMMAND-LINE ARGUMENTS CHANGED:
   - v2: positional argument `themes` was a list of 4+ theme names passed directly
     (e.g. "villains_2 villains_1 animals_1 flowers_food")
   - v3: two new arguments replace this:
     --base_themes: exactly 2 base theme names (e.g. "abstract_1 abstract_2")
     --n_versions: number of versions per base theme (default 3, giving 6 total)
     The versioned names are constructed internally as abstract_1_v1, abstract_1_v2, etc.

3. THEME ASSIGNMENT FUNCTION ADDED (assign_themes_to_slots):
   - v2 had get_theme(task, run) which returned shared or unique theme based on run index.
   - v3 has assign_themes_to_slots(final_order, versioned_themes) which:
     a. Randomly shuffles all 6 versioned themes
     b. Assigns one to each slot in final_order
     c. Checks adjacency constraint: no I→TI pair where both slots share the same
        base image set (e.g. abstract_1_v2 followed immediately by abstract_1_v3 is
        forbidden if the first slot is I and the second is TI)
     d. Retries the shuffle until a valid assignment is found (max 10000 attempts)
   - Note: T→TI adjacency with same base is ALLOWED (only I→TI is forbidden)

4. VALID_SLOT_ORDERS CONSTRAINT RELAXED:
   - v2 had a constraint that I1 and TI1 are never adjacent in the 4-slot remainder,
     encoded in VALID_SLOT_ORDERS. This was a theme-based constraint (to avoid same
     theme appearing in adjacent I and TI blocks).
   - v3 removes this constraint from VALID_SLOT_ORDERS entirely, because the adjacency
     check is now handled by assign_themes_to_slots at the theme-assignment level.
     Any ordering of the 4 remaining slots is now valid structurally.

5. theme_info LOGGING UPDATED:
   - v2 logged: shared_run, shared_theme, targets_unique_theme, instrumental_unique_theme,
     ti_unique_theme, slot_order
   - v3 logs: slot_theme_assignment (dict mapping slot key to versioned theme name),
     base_themes, slot_order
     This gives a complete record of which theme went to which slot.

6. make_slot SIGNATURE UNCHANGED but get_theme() calls replaced:
   - v2 called get_theme(task, run) inside generate_blocks to pass theme to make_slot.
   - v3 calls assign_themes_to_slots after final_order is determined, then looks up
     the theme for each slot from the assignment dict when building blocks.

7. FIRST-SLOT CONSTRAINT NOTE:
   - v2 guaranteed first slot is T or I via first_pair_option (['T1','I2'] or ['I1','T2']).
   - v3 keeps this same guarantee unchanged. No additional first-slot logic needed.
"""

import json
import random
import numpy as np
import argparse

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
SCENES = ["river", "river"]

# DIFFERENCE FROM v2: VALID_SLOT_ORDERS no longer excludes I1/TI1 adjacencies.
# In v2, this list was curated to avoid I and TI of the same run being adjacent,
# because they shared themes. In v3, the adjacency constraint is handled at the
# theme-assignment level in assign_themes_to_slots(), so all 4-slot orderings
# are structurally valid here.
VALID_SLOT_ORDERS = [
    ('T',   'I1',  'TI1', 'TI2'),
    ('T',   'I1',  'TI2', 'TI1'),
    ('T',   'TI1', 'I1',  'TI2'),
    ('T',   'TI1', 'TI2', 'I1' ),
    ('T',   'TI2', 'I1',  'TI1'),
    ('T',   'TI2', 'TI1', 'I1' ),
    ('I1',  'T',   'TI1', 'TI2'),
    ('I1',  'T',   'TI2', 'TI1'),
    ('I1',  'TI1', 'T',   'TI2'),
    ('I1',  'TI1', 'TI2', 'T'  ),
    ('I1',  'TI2', 'T',   'TI1'),
    ('I1',  'TI2', 'TI1', 'T'  ),
    ('TI1', 'T',   'I1',  'TI2'),
    ('TI1', 'T',   'TI2', 'I1' ),
    ('TI1', 'I1',  'T',   'TI2'),
    ('TI1', 'I1',  'TI2', 'T'  ),
    ('TI1', 'TI2', 'T',   'I1' ),
    ('TI1', 'TI2', 'I1',  'T'  ),
    ('TI2', 'T',   'I1',  'TI1'),
    ('TI2', 'T',   'TI1', 'I1' ),
    ('TI2', 'I1',  'T',   'TI1'),
    ('TI2', 'I1',  'TI1', 'T'  ),
    ('TI2', 'TI1', 'T',   'I1' ),
    ('TI2', 'TI1', 'I1',  'T'  ),
]


def make_orders(ncues_list, scenes):
    ncues_list = list(ncues_list)
    scenes = list(scenes)
    n_conditions = len(ncues_list)
    n_scenes = len(scenes)
    scene_orders = np.vstack([
        np.random.permutation(n_scenes)
        for _ in range(n_conditions)
    ])
    cue_orders = np.vstack([
        np.random.permutation(ncues_list)
        for _ in range(n_scenes)
    ]).T
    return scene_orders, cue_orders


def get_cue_and_theme_orders(task_names, nrepeats_per_cycle, scenes):
    assert len(scenes) == nrepeats_per_cycle
    assignments = {}
    for task in task_names:
        ncues_list = tasks[task][:]
        scene_orders, cue_orders = make_orders(ncues_list, scenes)
        assignments[task] = []
        for i in range(nrepeats_per_cycle):
            assignments[task].append((cue_orders[:, i].tolist(), scene_orders[:, i].tolist()))
    return assignments


def make_slot(name, run, orders, theme, ntrials_per_cue, scenes, paired_with=None):
    slot = []
    if name == 'targets' and paired_with is not None:
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


def make_practice(task, scenes):
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


def slot_key_to_task(slot_key):
    """Helper: map slot key (e.g. 'TI1', 'T2', 'I1') to task name string."""
    if slot_key.startswith('TI'):
        return 'targets-instrumental'
    elif slot_key.startswith('T'):
        return 'targets'
    else:
        return 'instrumental'


def base_theme(versioned_name):
    """
    DIFFERENCE FROM v2: new helper function.
    Extract the base theme name from a versioned theme name.
    e.g. 'abstract_1_v2' -> 'abstract_1'
    Used in adjacency constraint checking.
    """
    # Strip the trailing _vN suffix
    parts = versioned_name.rsplit('_v', 1)
    return parts[0]


def assign_themes_to_slots(final_order, versioned_themes, max_attempts=10000):
    """
    DIFFERENCE FROM v2: entirely new function replacing get_theme().

    Randomly assigns one versioned theme to each slot in final_order such that:
    - All 6 versioned themes are used exactly once
    - Each task type (T, I, TI) gets exactly one version of each base image set
      e.g. T slots get abstract_1_vX and abstract_2_vY (one from each base),
           I slots get abstract_1_vZ and abstract_2_vW,
           TI slots get abstract_1_vA and abstract_2_vB
    - No I→TI adjacency shares the same base image set
      (e.g. abstract_1_v2 on an I slot immediately followed by abstract_1_v3
       on a TI slot is forbidden)
    - T→TI adjacency with same base IS allowed

    Strategy:
    - Group versioned_themes by base (e.g. all abstract_1_vX together)
    - Shuffle versions within each base independently
    - For each task type, assign one version from each base (randomly which base goes first)
    - Then check the I→TI adjacency constraint; retry if violated

    Returns a dict mapping slot_key -> versioned_theme_name.
    Raises RuntimeError if no valid assignment found within max_attempts.
    """
    # Group slots by task type, preserving order within each group
    # e.g. T_slots = ['T1', 'I2'] if first_pair is ['T1','I2'] and T appears first
    t_slots  = [s for s in final_order if slot_key_to_task(s) == 'targets']
    i_slots  = [s for s in final_order if slot_key_to_task(s) == 'instrumental']
    ti_slots = [s for s in final_order if slot_key_to_task(s) == 'targets-instrumental']

    # Group versioned themes by base image set
    # e.g. {'abstract_1': ['abstract_1_v1','abstract_1_v2','abstract_1_v3'],
    #        'abstract_2': ['abstract_2_v1','abstract_2_v2','abstract_2_v3']}
    base_groups = {}
    for theme in versioned_themes:
        b = base_theme(theme)
        base_groups.setdefault(b, []).append(theme)
    bases = list(base_groups.keys())  # exactly 2 bases
    assert len(bases) == 2, f"Expected exactly 2 base themes, got {bases}"

    for attempt in range(max_attempts):
        # Shuffle versions within each base independently
        pool = {b: random.sample(vs, len(vs)) for b, vs in base_groups.items()}

        # Randomly decide which base goes to slot index 0 vs 1 within each task type
        # e.g. for T: T1 gets abstract_1, T2 gets abstract_2  OR  T1 gets abstract_2, T2 gets abstract_1
        assignment = {}
        for task_slots in [t_slots, i_slots, ti_slots]:
            base_order = random.sample(bases, 2)  # random permutation of the 2 bases
            for slot_key, b in zip(task_slots, base_order):
                assignment[slot_key] = pool[b].pop()

        # Check I→TI adjacency constraint
        valid = True
        for i in range(len(final_order) - 1):
            current_slot = final_order[i]
            next_slot = final_order[i + 1]
            current_task = slot_key_to_task(current_slot)
            next_task = slot_key_to_task(next_slot)

            # Only forbidden: I followed immediately by TI with same base theme
            if current_task == 'instrumental' and next_task == 'targets-instrumental':
                if base_theme(assignment[current_slot]) == base_theme(assignment[next_slot]):
                    valid = False
                    break

        if valid:
            return assignment

    raise RuntimeError(
        f"Could not find valid theme assignment after {max_attempts} attempts. "
        "Check that your base themes and slot order allow a valid assignment."
    )


def generate_blocks(task_names, base_themes, n_versions=3,
                    ntrials_per_cue=10, nrepeats_per_cycle=2, scenes=SCENES,
                    ntrials_per_cue_targets=None):
    """
    DIFFERENCE FROM v2: signature changed.
    - v2: generate_blocks(task_names, themes, ntrials_per_cue, nrepeats_per_cycle, scenes)
      where themes was a flat list of 4 theme name strings
    - v3: generate_blocks(task_names, base_themes, n_versions, ntrials_per_cue,
          nrepeats_per_cycle, scenes)
      where base_themes is a list of 2 base names and n_versions is versions per base (default 3)
    """
    all_blocks = []
    pair_targets_instrumental = "targets" in task_names and "instrumental" in task_names

    orders = get_cue_and_theme_orders(task_names, nrepeats_per_cycle, scenes)

    # DIFFERENCE FROM v2: construct versioned theme names from base_themes + n_versions
    # v2 received theme names directly; v3 constructs them here.
    # e.g. base_themes=['abstract_1','abstract_2'], n_versions=3 gives:
    # ['abstract_1_v1','abstract_1_v2','abstract_1_v3','abstract_2_v1','abstract_2_v2','abstract_2_v3']
    versioned_themes = [
        f"{base}_v{v}"
        for base in base_themes
        for v in range(1, n_versions + 1)
    ]
    assert len(versioned_themes) == 6, (
        f"Expected 6 versioned themes (2 bases × 3 versions), got {len(versioned_themes)}. "
        "Check --base_themes and --n_versions."
    )

    # Build all 6 slots (same structure as v2)
    slots = {}
    if pair_targets_instrumental:
        for run in range(nrepeats_per_cycle):
            inst_orders = orders["instrumental"][run]
            # Theme assignment happens after final_order is determined (see below)
            # so we use a placeholder here and fill in after assign_themes_to_slots
            slots[f'I{run+1}'] = ('instrumental', run, orders, inst_orders)
            slots[f'T{run+1}'] = ('targets', run, orders, inst_orders)

    if 'targets-instrumental' in task_names:
        for run in range(nrepeats_per_cycle):
            slots[f'TI{run+1}'] = ('targets-instrumental', run, orders, None)

    # Determine slot ordering (same logic as v2)
    first_pair_option = random.choice([
        ['T1', 'I2'],
        ['I1', 'T2'],
    ])
    if first_pair_option == ['T1', 'I2']:
        remaining_keys = ['T2', 'I1', 'TI1', 'TI2']
    else:
        remaining_keys = ['T1', 'I2', 'TI1', 'TI2']

    slot_order_template = random.choice(VALID_SLOT_ORDERS)
    placeholder_map = {
        'T':   remaining_keys[0],
        'I1':  remaining_keys[1],
        'TI1': 'TI1',
        'TI2': 'TI2'
    }
    remaining_order = [placeholder_map[s] for s in slot_order_template]
    final_order = first_pair_option + remaining_order

    # DIFFERENCE FROM v2: theme assignment via assign_themes_to_slots
    # v2 called get_theme(task, run) inline when building each slot.
    # v3 determines the full theme assignment for all slots at once, with
    # constraint checking, before building any blocks.
    theme_assignment = assign_themes_to_slots(final_order, versioned_themes)

    # Now build the actual slot block lists using the assigned themes
    built_slots = {}
    for slot_key in final_order:
        name, run, orders_, paired = slots[slot_key]
        theme = theme_assignment[slot_key]
        if name == 'targets':
            _ntrials = ntrials_per_cue_targets if ntrials_per_cue_targets is not None else ntrials_per_cue
            built_slots[slot_key] = make_slot(name, run, orders_, theme,
                                              _ntrials, scenes, paired_with=paired)
        else:
            built_slots[slot_key] = make_slot(name, run, orders_, theme,
                                              ntrials_per_cue, scenes)

    # Assemble blocks with practice prepended to every slot (same as v2)
    for slot_key in final_order:
        task = slot_key_to_task(slot_key)
        all_blocks.append(make_practice(task, scenes))
        all_blocks.extend(built_slots[slot_key])

    # DIFFERENCE FROM v2: theme_info structure updated
    # v2 logged: shared_run, shared_theme, targets_unique_theme,
    #            instrumental_unique_theme, ti_unique_theme, slot_order
    # v3 logs:   base_themes, slot_order, slot_theme_assignment
    #            (complete record of which versioned theme went to which slot)
    theme_info = {
        'base_themes': base_themes,
        'slot_order': final_order,
        'slot_theme_assignment': theme_assignment
    }

    return all_blocks, theme_info


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate randomized experiment blocks (v3).")

    # DIFFERENCE FROM v2: 'themes' positional arg replaced by --base_themes and --n_versions
    parser.add_argument("--base_themes", nargs="+", required=True,
                        help="Exactly 2 base theme names (e.g. abstract_1 abstract_2)")
    parser.add_argument("--n_versions", type=int, default=3,
                        help="Number of versioned shuffles per base theme (default: 3)")

    parser.add_argument("--tasks", nargs="+", default=DEFAULT_TASKS)
    parser.add_argument("--output", "-o", default="blocks.json")
    parser.add_argument("--ntrials_per_cue", type=int, default=10)
    parser.add_argument("--ntrials_per_cue_targets", type=int, default=None,
                        help="Override ntrials_per_cue for targets task only (default: same as --ntrials_per_cue)")
    parser.add_argument("--nrepeats_per_cycle", type=int, default=2)
    parser.add_argument("--end_probe_task", type=str, default=None)
    parser.add_argument("--end_probe_ncues", type=int, default=1)
    parser.add_argument("--end_probe_ntrials", type=int, default=30)
    parser.add_argument("--scenes", nargs="+", default=["river", "river"])

    args = parser.parse_args()

    assert len(args.base_themes) == 2, (
        f"Expected exactly 2 base themes, got {len(args.base_themes)}: {args.base_themes}"
    )

    ntrials_targets = args.ntrials_per_cue_targets if args.ntrials_per_cue_targets is not None else args.ntrials_per_cue

    blocks, theme_info = generate_blocks(
        args.tasks, args.base_themes, args.n_versions,
        args.ntrials_per_cue, args.nrepeats_per_cycle, args.scenes,
        ntrials_per_cue_targets=ntrials_targets
    )

    if args.end_probe_task:
        probe = make_end_probe(args.end_probe_task, args.end_probe_ncues,
                               args.end_probe_ntrials, SCENES)
        blocks.append(probe)

    # Write blocks as flat list (for the game)
    with open(args.output, "w") as f:
        json.dump(blocks, f, indent=2)

    # Write theme_info to separate log file
    theme_info_path = args.output.replace('.json', '_theme_info.json')
    with open(theme_info_path, "w") as f:
        json.dump(theme_info, f, indent=2)

    print(f"Generated {len(blocks)} blocks → saved to {args.output}")
    print(f"Theme info → saved to {theme_info_path}")
    print(f"Slot order: {theme_info['slot_order']}")
    print(f"Theme assignment: {theme_info['slot_theme_assignment']}")
