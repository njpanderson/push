const path = require('path');
const fs = require('fs');
const vscode = require('vscode');

const ServiceSFTP = require('./services/SFTP');
const Paths = require('./lib/Paths');

class PushModel {
	constructor(options) {
		this.options = Object.assign({}, {
			callbacks: {
				settingsChange: null
			}
		}, options);

		// Push extension configuration
		this.config = null;

		// Contextual server settings
		this.serverSettings = null;

		this.services = {
			SFTP: ServiceSFTP
		};

		this.uriContext = '';
		this.settingsCache = {};
		this.service = null;

		this.paths = new Paths();

		this.configChange = this.configChange.bind(this);
		this.checkServerSettingsChange = this.checkServerSettingsChange.bind(this);
	}

	/**
	 * The workspace configuration has changed
	 */
	configChange() {
		// Re-set the config from the workspace
		this.setConfig();

		// (Re)start the service for the current context
		this.startServiceInstance();
	}

	checkServerSettingsChange(textDocument) {
		if (path.basename(textDocument.uri.path) === this.config.settingsFilename) {
			// File being changed is a server config file - regenerate server settings
			this.setUriContext(textDocument.uri, false)
				.setServerSettings();
		}
	}

	setUriContext(uri, setConfigurations = true) {
		this.uriContext = this.getFileSrc(uri);

		if (setConfigurations) {
			return this.setConfig()
				.setServerSettings();
		}

		return this;
	}

	setServerSettings(settings) {
		settings = settings || this.getServerJSON(this.uriContext);

		if (settings) {
			if (settings.newFile) {
				// settings have changed.
				if (typeof this.options.callbacks.settingsChange === 'function') {
					// Emit change callback
					this.options.callbacks.settingsChange();
				}

				this.startServiceInstance(settings);
			}

			this.serverSettings = settings.data;

			return settings;
		}

		return false;
	}

	startServiceInstance(settings) {
		if (!settings) {
			settings = this.serverSettings;
		}

		if (settings) {
			// (Re)instantiate service
			if (settings.data.service && this.services[settings.data.service]) {
				console.log(`Reinstantiating service provider ${settings.data.service}`);

				this.service = new this.services[settings.data.service](
					this.config,
					settings.data[settings.data.service]
				);
			} else {
				this.service = null;
			}
		}
	}

	isDirectory(uri) {
		const stats = fs.statSync(uri.path);
		return stats.isDirectory();
	}

	/**
	 * Retrieves a source file based on the environment of the command.
	 * @param {object} uri - Source file URI
	 */
	getFileSrc(uri) {
		if (uri) {
			return uri;
		}

		// uri is not set or does not exist. attempt to get from the editor
		if (vscode.window.activeTextEditor) {
			return vscode.window.activeTextEditor &&
				vscode.window.activeTextEditor.document.uri;
		}

		return '';
	}

	/**
	 * @description
	 * Attempts to retrieve a server settings JSON file from the supplied URI,
	 * eventually ascending the directory tree to the root of the project.
	 * @param {object} uri - URI of the path in which to start looking
	 */
	getServerJSON(uri) {
		const file = this.paths.findFile(
			this.config.settingsFilename,
			path.dirname(uri.path)
		);

		let fileContents, newFile;

		if (file !== '' && fs.existsSync(file)) {
			// File isn't empty and exists - read and set into cache
			fileContents = (fs.readFileSync(file, "UTF-8")).toString().trim();

			if (fileContents !== '') {
				try {
					newFile = (
						!this.settingsCache ||
						fileContents !== this.settingsCache
					);

					this.settingsCache = fileContents;

					return {
						file,
						data: JSON.parse(fileContents),
						newFile
					};
				} catch(e) {
					return null;
				}
			}
		}
	}

	setConfig(config) {
		this.config = config || this.getConfig();
		return this;
	}

	getConfig(key = null) {
		const config = vscode.workspace.getConfiguration(
			'njpPush',
			vscode.window.activeTextEditor.document.uri
		);

		if (key) {
			return config[key] || null;
		}

		return config;
	}

	execServiceMethod(method) {
		if (this.service) {
			return this.service[method].apply(this.service, Array.prototype.slice.call(arguments, 1));
		}
	}
}

module.exports = PushModel;