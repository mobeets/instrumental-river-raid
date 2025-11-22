
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
		this.block_configs = config.blocks;
		this.block_index = -1;
		this.blocks = [];
	}

	next_block() {
		if (this.is_complete()) return;
		this.block_index++;
		let block = new TrialBlock(this.block_configs[this.block_index]);
		this.blocks.push(block);
		return block;
	}

	is_complete() {
		return this.blocks.length >= this.block_configs.length;
	}

	toJSON() {
    // outputs all of object's variables as a json object
    return Object.assign({}, this);
  }

}

class TrialBlock {
	constructor({name, K, is_practice, ntrials_per_cue, scene}) {
		this.name = name;
		this.K = K;
		this.is_practice = is_practice;
		this.ntrials_per_cue = ntrials_per_cue;
		this.scene = scene;
		this.cue_list = this.makeCueSequence(this.K, this.ntrials_per_cue);
		this.trial_index = -1;
		this.trial;
		this.trials = [];
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

	respond(response) {
		this.trial.respond(response);
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
		this.response;
	}

	respond(response) {
		this.response = response;
		this.responseTime = millis();
	}

	toJSON() {
    // outputs all of object's variables as a json object
    return Object.assign({}, this);
  }
}
