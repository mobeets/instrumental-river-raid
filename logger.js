
class EventLogger {
	constructor() {
		this.data = {events: []};
		this.events = [];
	}

	log(event, time = millis(), message = '') {
	  // if message is provided, we will trigger photodiode
	  if (typeof event === "string") {
	    event = {name: event};
	  }
	  // n.b. here we assume it is an object
	  event.time = time;
	  event.message = message;

	  if (message !== "" && photodiode !== undefined) {
	  	event.photodiode = true;
	  	photodiode.trigger();
	  } else {
	  	event.photodiode = false;
	  }

	  this.data.events.push(event);
	  console.log(event);
	}

	download(filename = 'data') {
		// saves everything in data to .json locally

		// Pretty-print with 2-space indent
	  let jsonString = JSON.stringify(this.data, null, 2);

	  // Create a Blob from the JSON string
	  let blob = new Blob([jsonString], { type: 'application/json' });

	  // Create a temporary download link
	  let url = URL.createObjectURL(blob);
	  let a = document.createElement('a');
	  a.href = url;
	  a.download = filename + '.json';
	  a.click();

	  // Clean up the URL object
	  URL.revokeObjectURL(url);
	}
}
