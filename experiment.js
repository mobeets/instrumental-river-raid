
function makeCueSequence(ncues, ntrials_per_cue) {
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

class TrialBlock {
	constructor(name, K, is_practice, ntrials_per_cue) {
		this.name = name;
		this.K = K;
		this.is_practice = is_practice;
		this.ntrials_per_cue = ntrials_per_cue;
		this.cue_list = makeCueSequence(this.K, this.ntrials_per_cue);
		this.trial_index = -1;
		this.trial;
		this.trials = [];
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
