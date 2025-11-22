
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
    config_name: 'default'
  };

  // Merge defaults with URL params
  const urlParams = getUrlParams();
  const finalParams = { ...defaults, ...urlParams };

  // Safe destructuring with fallback defaults
  const {
    subject_id = 'unknown',
    config_name = 'default'
  } = finalParams;

  // Build path to config file
  const config_path = `configs/${config_name}.json`;

  // In preload(), loadJSON() returns the parsed JSON synchronously
  const config = loadJSON(config_path);
  return {subject_id, config_path, config};
}

class Experiment {
	constructor({subject_id, config_path, config}) {
		this.subject_id = subject_id;
		this.config_path = config_path;
		this.params = config.params;
		this.block_configs = config.blocks;
		this.block_index = -1;
		this.blocks = [];
	}

	next_block(restartGame) {
		if (!restartGame) {
			if (this.no_more_blocks()) return;
			this.block_index++;
		}
		let block = new TrialBlock(this.block_index, this.block_configs[this.block_index]);
		this.blocks.push(block);
		return block;
	}

	no_more_blocks() {
		return this.blocks.length >= this.block_configs.length;
	}

	is_complete() {
		return this.no_more_blocks();
	}

	toJSON() {
    // outputs all of object's variables as a json object
    return Object.assign({}, this);
  }
}

let themeOffsets = {2: 0, 3: 2, 4: 5, 5: 9, 6: 14};
class TrialBlock {
	constructor(index, {name, ncues, is_practice, ntrials_per_cue, theme, scene}) {
		this.name = name;
		this.index = index;
		this.ncues = ncues;
		this.is_practice = is_practice;
		this.ntrials_per_cue = ntrials_per_cue;
		this.theme = theme;
		this.theme_offset = themeOffsets[this.ncues];
		this.scene = scene;
		this.cue_list = this.makeCueSequence(this.ncues, this.ntrials_per_cue);
		this.trial_index = -1;
		this.trial;
		this.trials = [];
		this.score = 0;
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

	next_trial() {
		if (this.is_complete()) return;
		this.trial_index++;
		let trial = new Trial(this.cue_list[this.trial_index]);
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
	constructor(cue) {
		this.cue = cue;
		this.startTime = millis();
		this.events = [];
	}

	trigger(event) {
		if (typeof event === "string") {
	    event = {name: event};
	  }
		event.time = millis();
		this.events.push(event);
	}

	toJSON() {
    // outputs all of object's variables as a json object
    return Object.assign({}, this);
  }
}
