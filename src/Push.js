const PushModel = require('./PushModel');

class Push {
	constructor() {
		this.model = new PushModel();
	}

	upload() {
		return this.model.service.exec('put', this.model.getUriContextPath());
	}

	download() {
		return this.model.service.exec('get', this.model.getUriContextPath());
	}

	getConfig(key) {
		return this.model.getConfig(key);
	}
}

module.exports = Push;