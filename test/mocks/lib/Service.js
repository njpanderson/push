const counter = require('../../helpers/counter');

class Service {
	constructor() {
		this.restartServiceInstance = counter.create('Service#restartServiceInstance');
	}

	exec(method, config, args) {
		return this[method].apply(this, args);
	}

	execSync(method, config, args) {
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
