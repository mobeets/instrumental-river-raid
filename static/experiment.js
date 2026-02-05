
function getUrlParams() {
	// parses index.html?key1=val1&key2=val2 to {key1: val1, ...}
  const params = {};
  for (const [key, val] of new URLSearchParams(window.location.search)) {
    params[key] = val;
  }
  return params;
}

function loadConfig() {
	// loads config named in url params
	// call inside preload

  const defaults = {
    subject_id: 'unknown',
    experiment: 'default_experiment',
    params_name: 'default_params',
  };

  // Merge defaults with URL params
  const urlParams = getUrlParams();
  const finalParams = { ...defaults, ...urlParams };

  // Safe destructuring with fallback defaults
  const {
    subject_id = 'unknown',
    experiment = 'default_experiment',
    params_name ='default_params',
  } = finalParams;

  // Build path to config file
  const blocks_path = `configs/${experiment}.json`;

  // Build path to params file
  const params_path = `configs/${params_name}.json`;

  // In preload(), loadJSON() returns the parsed JSON synchronously
  const blocks = loadJSON(blocks_path);
  const params = loadJSON(params_path);
  return {subject_id, blocks_path, params_path, blocks, params};
}

class Experiment {
	constructor({subject_id, blocks_path, params_path, blocks, params}) {
		this.subject_id = subject_id;
		this.config_path = blocks_path;
		this.params_path = params_path;
		this.block_configs = Object.values(blocks);
		this.params = params;
		this.block_index = -1;
		this.block_count = -1;
		this.blocks = [];
	}

	next_block(restartGame, goBack) {
		if (!restartGame && !goBack) {
			if (this.blocks.length > 0) {
				// log end of block
				this.blocks[this.blocks.length-1].log(false);
			}
			if (this.no_more_blocks()) {
				// log end of experiment
				wsLogger.saveJson(this);
				this.log(false);
				return;
			};
			this.block_index++;
		} else if (goBack) {
			if (this.block_index >= 1) this.block_index--;
		}

		this.block_count++;
		let block = new TrialBlock(this.block_index, this.block_count, this, this.block_configs[this.block_index]);
		this.blocks.push(block);
		return block;
	}

	log(isNew = true) {
		let msg = "start of Experiment";
		if (!isNew) msg = "end of Experiment";
		wsLogger.log(msg, this.toJSON());
	}

	no_more_blocks() {
		return this.block_index+1 >= this.block_configs.length;
	}

	is_complete() {
		return this.no_more_blocks();
	}

	toJSON() {
    // outputs all of object's variables as a json object
    return Object.assign({}, this);
  }
}

// - animals 1: 2-5
// - animals 2: 2-5
// - flowers_food: 2-5
// - land_animals: 2-5

// let themeOffsets = {
// 	animals: {2: 0, 3: 2, 4: 5, 5: 9, 6: 14},
// 	flowers: {},
// 	land: {},
// 	food: {},
// 	real_animals: {},
// 	training: {}
// };

let themeOffsets = {2: 0, 3: 2, 4: 5, 5: 9, 6: 14};

let nextThemeOffsets = {
	animals: 0,
	flowers: 0,
	land: 0,
	food: 0,
	real_animals: 0,
	training: 0
};

function getNextThemeOffset(theme, ncues) {
	if (theme === undefined || theme.length === 0) return 0;
	let nextOffset = nextThemeOffsets[theme];
	nextThemeOffsets[theme] += ncues;
	return nextOffset;
}

function makeBalancedOneHotMatrix(rows, cols) {
  // Smallest N such that N*cols ≥ rows
  const N = Math.ceil(rows / cols);

  // Build stacked identity (size N*cols x cols)
  let M = [];
  for (let n = 0; n < N; n++) {
    for (let i = 0; i < cols; i++) {
      let row = Array(cols).fill(0);
      row[i] = 1;
      M.push(row);
    }
  }

  // Only keep first K rows
  M = M.slice(0, rows);

  // Shuffle rows (Fisher–Yates)
  for (let i = M.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [M[i], M[j]] = [M[j], M[i]];
  }

  // Return first K rows
  return M;
}

function randomR(rows, cols, maxEntropyPolicy = false) {
  // creates random ncues x D binary reward matrix
  // each row will have exactly one nonzero entry
  // R[k][d] = 1 means projectile d destroys color k
  // if maxEntropyPolicy, then ensures every action is optimal for at least one cue
  if (maxEntropyPolicy) {
    return makeBalancedOneHotMatrix(rows, cols);
  }

  let R = [];
  for (let i = 0; i < rows; i++) {
    let row = Array(cols).fill(0);
    row[Math.floor(Math.random() * cols)] = 1; // choose one random position
    R.push(row);
  }
  return R;
}

function divideRange(x_start, x_end, n_segments) {
  // subdivide range (x_start, x_end) into n_segments equal segments
  const result = [];
  const step = (x_end - x_start) / n_segments;
  for (let i = 0; i <= n_segments; i++) {
    result.push(x_start + i * step);
  }
  return result;
}

class TrialBlock {
	constructor(block_index, block_count, E, {name, ncues, is_practice, ntrials_per_cue, theme, instructions, scene}) {
		this.name = name;
		this.block_count = block_count;
		this.block_index = block_index;
		this.ncues = ncues;
		this.is_practice = is_practice;
		this.ntrials_per_cue = ntrials_per_cue;
		this.theme = theme;
		this.theme_offset = themeOffsets[this.ncues];
		// this.theme_offset = getNextThemeOffset(this.theme, this.ncues);
		this.scene = scene;
		this.instructions = instructions;
		this.cue_locations = [];
		this.cue_list = [];
		this.cue_colors = shuffle(BOAT_COLORS).slice(0, this.ncues);
		this.R = this.getRewardMatrix(E);
		this.trial_index = -1;
		this.trial;
		this.trials = [];
		this.score = 0;
		this.log();
	}

	getRewardMatrix(E) {
		return randomR(this.ncues, E.params.nactions, E.params.maxEntropyPolicy);
	}

	log(isNew = true) {
		let msg = "start of TrialBlock";
		if (!isNew) msg = "end of TrialBlock";
		wsLogger.log(msg, this.toJSON());
	}

	makeCueSequence(ncues, ntrials_per_cue) {
		// creates a pseudorandom sequence of integers (1..ncues)
		// with length ncues * ntrials_per_cue
	  let xs = [];

	  for (let block = 0; block < ntrials_per_cue; block++) {
	    // Create array [1, 2, ..., ncues]
	    let blockArray = [];
	    for (let i = 1; i <= ncues; i++) {
	      blockArray.push(i);
	    }

	    // Shuffle in place (Fisher–Yates)
	    for (let i = blockArray.length - 1; i > 0; i--) {
	      let j = floor(random(i + 1));  // p5.js random integer
	      [blockArray[i], blockArray[j]] = [blockArray[j], blockArray[i]];
	    }

	    // Append this permuted block
	    xs = xs.concat(blockArray);
	  }
	  return xs;
	}

	makeLocationSequence(ncues, ntrials_per_cue) {
		// creates a pseudorandom sequence of integers (0..ntrials_per_cue-1)
		// for each cue in 0...ncues-1
	  let locs_per_cue = [];
	  for (let k = 0; k < ncues; k++) {
	    // Create array [0, 1, ..., ntrials_per_cue-1]
	    let locArray = [];
	    for (let i = 0; i < ntrials_per_cue; i++) {
	      locArray.push(i);
	    }

	    // Shuffle in place (Fisher–Yates)
	    for (let i = locArray.length - 1; i > 0; i--) {
	      let j = floor(random(i + 1));  // p5.js random integer
	      [locArray[i], locArray[j]] = [locArray[j], locArray[i]];
	    }

	    // Append this location list
	    locs_per_cue.push(locArray);
	  }
	  return locs_per_cue;
	}

	setTrialOrder() {
		let cue_list = this.makeCueSequence(this.ncues, this.ntrials_per_cue);
		let loc_list = this.makeLocationSequence(this.ncues, this.ntrials_per_cue);
		let cue_index = Array(this.ncues).fill(0);
		let res = [];
		for (var i = 0; i < cue_list.length; i++) {
			let cue = cue_list[i];
			let next_index = cue_index[cue-1];
			let loc_index = loc_list[cue-1][next_index];
			cue_index[cue-1]++;
			res.push({cue: cue, location_index: loc_index});
		}
		this.cue_list = res;
		this.cue_locations = divideRange(riverX + cueWidth/2, riverX + riverWidth - cueWidth/2, this.ntrials_per_cue);
	}

	next_trial() {
		if (this.is_complete()) {
			return;
		}
		if (this.trials.length > 0) {
			this.trials[this.trials.length-1].log(false);
		}
		this.trial_index++;
		let trial_info = this.cue_list[this.trial_index];
		let trial = new Trial(this.trial_index, this.index, trial_info.cue, trial_info.location_index);
		trial.log(true);
		this.trials.push(trial);
		return trial;
	}

	is_complete() {
		return this.trials.length >= this.cue_list.length;
	}

	toJSON() {
    // outputs all of object's variables as a json object
    return Object.assign({}, this);
  }
}

class Trial {
	constructor(index, block_index, cue, location_index) {
		this.index = index;
		this.block_index = block_index;
		this.cue = cue;
		this.location_index = location_index;
		this.events = [];
		this.positions = {
			time: [],
			agent: {x: [], y: []},
			cue: {x: [], y: []},
			projectile: {x: [], y: []}
		};
	}

	logPositions(jet, boats, projectiles) {
		this.positions.time.push(performance.now());
		this.positions.agent.x.push(jet.x);
		this.positions.agent.y.push(jet.y);
		if (boats.length === 1) {
			this.positions.cue.x.push(boats[0].x);
			this.positions.cue.y.push(boats[0].y);
		} else {
			this.positions.cue.x.push(NaN);
			this.positions.cue.y.push(NaN);
		}
		if (projectiles.length === 1) {
			this.positions.projectile.x.push(projectiles[0].x);
			this.positions.projectile.y.push(projectiles[0].y);
		} else {
			this.positions.projectile.x.push(NaN);
			this.positions.projectile.y.push(NaN);
		}
	}

	log(isNew = true) {
		let msg = "start of Trial";
		if (!isNew) msg = "end of Trial";
		wsLogger.log(msg, this.toJSON());
	}

	logEvent(event, callback) {
	  event.trial_index = this.index;
	  event.cue = this.cue;
	  event.block_index = this.block_index;
	  event.time = performance.now();
		wsLogger.log("Trial event", event, false, callback);
	}

	trigger(event, callback) {
		if (typeof event === "string") {
	    event = {name: event};
	  }
	  this.logEvent(event, callback);
		this.events.push(event);
	}

	toJSON() {
    // outputs all of object's variables as a json object
    return Object.assign({}, this);
  }
}
