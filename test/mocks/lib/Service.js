const counter = require('../../helpers/counter');

class Service {
	constructor() {
		this.restartServiceInstance = counter.bind('Service#restartServiceInstance');
	}

	exec(method, config, args) {
		return this[method].apply(this, args);
	}

	convertUriToRemote(uri) {
		return uri;
	}

	stop() {
		return Promise.resolve();
	}
}

module.exports = Service;
