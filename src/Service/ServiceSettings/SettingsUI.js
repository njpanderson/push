const vscode = require('vscode');

const utils = require('../../lib/utils');

class SettingsUI {
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

			this.panel.webview.postMessage('hello webview!');

			resolve();
		});
	}
}

module.exports = SettingsUI;
