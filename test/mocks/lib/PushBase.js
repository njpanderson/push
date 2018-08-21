const config = require('../../helpers/config');

class PushBase {
	constructor() {
		this.config = config;
	}

	rateLimit(id, timeout, fn) {
		return fn;
	}

	clearTimedExecution() {

	}
}

module.exports = PushBase;
