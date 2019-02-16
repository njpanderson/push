const vscode = require('vscode');

const utils = require('../../lib/utils');
const VSCodeMessaging = require('../../messaging/VSCodeMessaging');
const { COMMS } = require('../../lib/constants/static');
const ServiceDirectory = require('../ServiceDirectory');

class SettingsUI {
	constructor(settings) {
		this.serviceSettings = settings;
		this.settingsFile = null;
		this.directory = new ServiceDirectory();
	}

	/**
	 *
	 * @param {Uri} settingsFile
	 */
	show(settingsFile) {
		this.settingsFile = settingsFile;

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

			// Init messaging
			this.messaging = new VSCodeMessaging(this.panel.webview);
			this.messaging.onReceive(this.onReceive.bind(this));

			// Set panel content
			this.panel.webview.html = utils.getAsset('service-ui/index.html');

			resolve();
		});
	}

	/**
	 * Handle receiving messages from web view
	 * @param {string} type - Message type
	 * @param {*} data - Message data
	 */
	onReceive(type, data) {
		switch (type) {
		case COMMS.VIEW_INIT:
			// View has initialised. send initial state
			this.messaging.post(
				COMMS.SET_INITIAL_STATE,
				{
					settings: this.serviceSettings.parseServerFile(
						this.settingsFile, false
					),
					schemas: this.serviceSettings.getAllServiceSchemas()
				}
			);
			break;

		case COMMS.GET_SERVICE_OPT_SCHEMA:
			// Requesting schema - send back
			this.messaging.post(
				COMMS.SET_SERVICE_OPT_SCHEMA,
				this.serviceSettings.getServiceSchema(data.service)
			);
			break;
		}
	}
}

module.exports = SettingsUI;
