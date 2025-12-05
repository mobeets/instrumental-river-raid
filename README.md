## Setup

Requirements: [uv](https://docs.astral.sh/uv/#installation).

To start the server for a patient named `SUBJECT_ID`, run the following in a terminal:
`uv run python server.py --save_name SUBJECT_ID`

Then go to the url listed in a browser and click around.
Your mouse clicks and key presses will be saved locally to the file `logs/SUBJECT_ID.jsonl`.

In a Chrome browser, open `http://0.0.0.0:8000?subject=SUBJECT_ID` to start the task
- Appending to the url `&params_name=debug` will load the config file `configs/debug.json`
- Appending `&experiment=default_experiment` to the url will load the experiment file `configs/default_experiment.json`

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
