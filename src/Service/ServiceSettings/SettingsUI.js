const vscode = require('vscode');

const utils = require('../../lib/utils');
const messaging = require('../../lib/messaging');
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

			// Set panel content
			this.panel.webview.html = utils.getAsset('service-ui/index.html');

			this.panel.webview.onDidReceiveMessage((event) => {
				console.log('message from webview!');
				console.log(event);
			});

			messaging.postMessage(
				this.panel.webview,
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
