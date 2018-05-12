const counter = require('../../helpers/counter');

class Channel {
	constructor() {
		this.appendLocalisedInfo = counter.bind('Channel#appendLocalisedInfo')
	}
}

module.exports = (new Channel());