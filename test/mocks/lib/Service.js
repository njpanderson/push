const counter = require('../../helpers/counter');
const ServiceSettings = require('./ServiceSettings');

class Service {
	constructor() {
		this.restartServiceInstance = counter.create('Service#restartServiceInstance');
		this.settings = new ServiceSettings.sftp();
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
