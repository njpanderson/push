const vscode = require('vscode');

const utils = require('../../lib/utils');
const VSCodeMessaging = require('../../messaging/VSCodeMessaging');
const { COMMS } = require('../../lib/constants/static');
const ServiceDirectory = require('../ServiceDirectory');

class SettingsUI {
	constructor(settings) {
		this.settings = settings;
		this.directory = new ServiceDirectory();
	}

	/**
	 *
	 * @param {Uri} settingsFile
	 */
	show(settingsFile) {
		return new Promise((resolve, reject) => {
			// TODO: rejection if the file doesn't exist?
			this.panel = vscode.window.createWebviewPanel(
				'push.serviceSettings',
				'Push Service Settings',
				vscode.ViewColumn.One,
				{
					enableScripts: true
				}
			);

			this.messaging = new VSCodeMessaging(this.panel.webview);

			// Set panel content
			this.panel.webview.html = utils.getAsset('service-ui/index.html');

			this.messaging.onReceive(this.onReceive.bind(this));

			this.messaging.post(
				COMMS.SET_INITIAL_STATE,
				this.settings.parseServerFile(settingsFile, false)
			);

			resolve();
		});
	}

	onReceive(type, data) {
		switch (type) {
		case COMMS.GET_SERVICE_OPT_SCHEMA:
			this.messaging.post(
				COMMS.SET_SERVICE_OPT_SCHEMA,
				{} // TODO: Schema goes here!
			);
			break;
		}
	}
}

module.exports = SettingsUI;
