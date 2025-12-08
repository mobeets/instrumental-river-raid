## Requirements

- [uv](https://docs.astral.sh/uv/#installation)

## Starting the task

To start the server, run the following in a terminal:

`uv run python server.py --log_dir logs --save_name SUBJECT_ID`

This will save all trial data, mouse clicks, and key presses locally to the file `logs/SUBJECT_ID.jsonl`.

To start the task, open a Chrome browser and navigate to `http://0.0.0.0:8000?subject=SUBJECT_ID`.

## Experiment details

- Default params can be found in `configs/default_params.json`, and overrided by appending `&params_name=example` to the url (this will load the config file `configs/example.json`)
- Default block order can be found in `configs/default_experiment.json`, and overrided by appending `&experiment=experiment` to the url (this will load the experiment file `configs/experiment.json`)

## Controls

On the experimenter's side:
- `p` to pause
- `r` to restart the current block from trial 1
- `n` to move to the next block
- `b` to move to the previous block

On the patient's side (with USB controller connected):
- Left analog stick controls the jet (left and right only)
- X, A, B buttons (with XBox controller) fire projectiles 1, 2, and 3
- START button to pause

All task controls can be found in `static/task_controls.js`.

## Debugging

It is recommended to keep the Web Inspector in Chrome open in a separate window so you can make sure the WebSocket remains connected.

Also note that you can save a copy of the experimental data manually by pausing and pressing 's'.
