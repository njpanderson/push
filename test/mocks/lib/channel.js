const counter = require('../../helpers/counter');

class Channel {
	constructor() {
		this.appendLocalisedInfo = counter.create('Channel#appendLocalisedInfo')
		this.appendLocalisedError = counter.create('Channel#appendLocalisedError')
		this.appendError = counter.create('Channel#appendError')
	}
}

module.exports = (new Channel());
