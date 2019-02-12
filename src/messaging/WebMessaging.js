const MessagingBase = require('../MessagingBase');

class Messaging extends MessagingBase {
	constructor(vscodeApi) {
		super();

		this.vscodeApi = vscodeApi;

		window.addEventListener('message', this.onReceive.bind(this), false);
	}

	post(type, data) {
		this.vscodeApi.postMessage(this.formatMessage(type, data));
	}
}

module.exports = Messaging;
