const counter = require('../../helpers/counter');

class Channel {
	constructor() {
		this.appendLocalisedInfo = counter.bind('Channel#appendLocalisedInfo')
		this.appendError = counter.bind('Channel#appendError')
	}
}

module.exports = (new Channel());
