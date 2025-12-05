## Requirements

- [uv](https://docs.astral.sh/uv/#installation).

## Starting the task

To start the server for a patient named `SUBJECT_ID`, run the following in a terminal:
`uv run python server.py --save_name SUBJECT_ID`

In a Chrome browser, open `http://0.0.0.0:8000?subject=SUBJECT_ID` to start the task.

## Experiment details

- Default params can be found in `configs/default_params.json`, and overrided by appending `&params_name=example` to the url (this will load the config file `configs/example.json`)
- Default block order can be found in `configs/default_experiment.json`, and overrided by appending `&experiment=experiment` to the url (this will load the experiment file `configs/experiment.json`)

All trial data, mouse clicks, and key presses will be saved locally to the file `logs/SUBJECT_ID.jsonl`.

## Controls

On the experimenter's side:
- `p` to pause
- `r` to restart the current block from trial 1
- `n` to move to the next block

On the patient's side (with USB controller connected):
- Left analog stick controls the jet (left and right only)
- X, A, B buttons (with XBox controller) fire the projectile
- START button to pause

All task controls can be found in `static/task_controls.js`.
