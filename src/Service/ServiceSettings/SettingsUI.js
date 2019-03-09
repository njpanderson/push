const vscode = require('vscode');
const merge = require('lodash/merge');

const utils = require('../../lib/utils');
const VSCodeMessaging = require('../../messaging/VSCodeMessaging');
const ServiceDirectory = require('../ServiceDirectory');
const i18n = require('../../i18n');
const paths = require('../../lib/paths');
const { COMMS } = require('../../lib/constants/static');

class SettingsUI {
	constructor(settings) {
		this.panels = {};
		this.serviceSettings = settings;
		this.directory = new ServiceDirectory();
	}

	/**
	 *
	 * @param {Uri} settingsFile
	 */
	show(settingsFile) {
		return new Promise((resolve, reject) => {
			// TODO: rejection if the file doesn't exist?
			// TODO: Support multiple panels!
			const panel = this.getPanel(settingsFile);

			// Set panel content
			panel.context.webview.html = utils.getAsset('service-ui/index.html');

			resolve();
		});
	}

	/**
	 * Handle receiving messages from web view
	 * @param {WebviewPanel} panel - The webview panel
	 * @param {string} type - Message type
	 * @param {*} data - Message data
	 */
	onReceive(panel, type, data) {
		switch (type) {
		case COMMS.VIEW_INIT:
			// View has initialised. send initial state
			panel.messaging.post(
				COMMS.SET_INITIAL_STATE,
				{
					// Send the settings contents, converted to an array
					settings: this.serviceSettingsToUI(
						this.serviceSettings.parseServerFile(
							panel.settingsFile, false
						)
					),
					// Send the schemas
					schemas: this.serviceSettings.getAllServiceSchemas(),
					// Send the full path of the service file
					filename: paths.getNormalPath(panel.settingsFile)
				}
			);
			break;

		case COMMS.GET_FILE_SELECTION:
			// Create an open dialog and respond with the selected file
			vscode.window.showOpenDialog({
				defaultUri: data && data.defaultValue ?
					vscode.Uri.file(data.defaultValue) : null,
				canSelectMany: false,
				openLabel: i18n.t('btn_select_file')
			}).then((file) => {
				// Respond with selected file
				if (file && file.length) {
					panel.messaging.post(COMMS.SET_FILE_SELECTION, {
						map: data.map,
						file: paths.getNormalPath(file[0])
					});
				}
			});
			break;

		case COMMS.GET_SERVICE_OPT_SCHEMA:
			// Respond with requested schema
			panel.messaging.post(
				COMMS.SET_SERVICE_OPT_SCHEMA,
				this.serviceSettings.getServiceSchema(data.service)
			);
			break;

		case COMMS.SAVE:
			// Save the settings to the original file
			this.saveServiceSettings(data.filename, data.settings);
			break;

		case COMMS.CLOSE:
			// Close the webview
			panel.context.dispose();
		}
	}

	saveServiceSettings(filename, settings) {
		const uri = vscode.Uri.file(filename);

		if (!paths.pathInWorkspaceFolder(uri)) {
			utils.showError(i18n.t('service_file_not_in_workspace', filename));
			return;
		}

		paths.writeFile(
			JSON.stringify(
				this.stripInternalKeys(this.uiSettingsToService(settings)),
				null,
				'\t'
			),
			uri
		).then(() => {
			utils.showLocalisedMessage('service_file_saved', paths.getBaseName(uri));
		}, (error) => {
			utils.showError(i18n.t('couldnt_save_service_file', filename, error));
		});
	}

	/**
	 * Converts service settings to array data for use within the UI.
	 * @param {object} settings - Settings as returned from
	 * serviceSettings#parseServerFile.
	 */
	serviceSettingsToUI(settings) {
		return Object.keys(settings).filter(key => key !== 'env').map((key) => {
			return merge({}, settings[key], {
				active: (key === settings.env),
				id: key
			});
		});
	}

	/**
	 * Converts UI settings back to those expected by
	 * ServiceSettings#editServiceConfig
	 * @param {array} settings - Settings as returned by the COMMS.SAVE
	 * payload.
	 */
	uiSettingsToService(settings) {
		const settingsObject = {};

		settings.forEach((env) => {
			settingsObject[env.id] = {
				service: env.service,
				options: {...env.options}
			};

			if (env.active) {
				settingsObject.env = env.id;
			}
		});

		return settingsObject;
	}

	/**
	 * Strips internal keys used by the UI (keys starting with "_").
	 * @param {object} ob - Object to parse.
	 * @returns {object} a new object with the internal keys stripped.
	 */
	stripInternalKeys(ob) {
		let newOb, key;

		if (Array.isArray(ob)) {
			return ob.map((item) => {
				return this.stripInternalKeys(item);
			});
		} else if (typeof ob === 'object') {
			newOb = {};

			for (key in ob) {
				if (ob.hasOwnProperty(key) && !key.startsWith('_')) {
					if (typeof ob[key] === 'object') {
						newOb[key] = this.stripInternalKeys(ob[key]);
					} else {
						newOb[key] = ob[key];
					}
				}
			}

			return newOb;
		} else {
			return ob;
		}
	}

	getPanel(settingsFile) {
		const id = paths.getFilenameHash(settingsFile);

		if (this.panels[id]) {
			return this.panels[id];
		}

		this.panels[id] = {
			messaging: null,
			settingsFile,
			context: vscode.window.createWebviewPanel(
				'push.serviceSettings',
				'Push Service Settings',
				vscode.ViewColumn.One,
				{
					enableScripts: true
				}
			)
		};

		this.panels[id].context.onDidDispose(() => {
			this.panels[id] = null;
			delete this.panels[id];
		});

		// Set up messaging for this panel
		this.panels[id].messaging = new VSCodeMessaging(this.panels[id].context.webview);
		this.panels[id].messaging.onReceive((type, data) => {
			this.onReceive(this.panels[id], type, data);
		});

		return this.panels[id];
	}
}

module.exports = SettingsUI;
