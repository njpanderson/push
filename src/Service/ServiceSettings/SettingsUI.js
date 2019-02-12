const vscode = require('vscode');

const utils = require('../../lib/utils');
const VSCodeMessaging = require('../../messaging/VSCodeMessaging');
const { COMMS } = require('../../lib/constants/static');

class SettingsUI {
	constructor(settings) {
		this.settings = settings;
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

			this.messaging.onReceive((type, data) => {
				console.log('message from webview!');
				console.log(type, data);
			});

			this.messaging.post(
				COMMS.TASK_INITIAL_STATE,
				{
					contents: this.settings.parseServerFile(settingsFile, false)
				}
			);

			resolve();
		});
	}
}

module.exports = SettingsUI;
