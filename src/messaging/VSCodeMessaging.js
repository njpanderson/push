const MessagingBase = require('../MessagingBase');

class VSCodeMessaging extends MessagingBase {
	constructor(webview) {
		super();

		this.webview = webview;

		this.webview.onDidReceiveMessage(this.onReceive.bind(this));
	}

	post(type, data) {
		this.webview.postMessage(this.formatMessage(type, data));
	}
}

module.exports = VSCodeMessaging;
