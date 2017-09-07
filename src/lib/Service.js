const path = require('path');
const vscode = require('vscode');
const fs = require('fs');

const ServiceSFTP = require('../services/SFTP');
const Paths = require('../lib/Paths');

class Service {
	constructor(config) {
		// Push configuration
		this.config = config;

		// Contextual server settings
		this.settings = null;

		this.services = {
			SFTP: ServiceSFTP
		};

		this.settingsCache = {};
		this.activeService = null;
		this.paths = new Paths();

		this.checkServiceSettingsChange = this.checkServiceSettingsChange.bind(this);

		vscode.workspace.onDidSaveTextDocument(this.checkServiceSettingsChange);
	}

	exec(method) {
		if (!this.activeService) {
			// Show a service error
			vscode.window.showErrorMessage(
				`A transfer service was not defined within the settings file` +
				` at ${this.config.settingsFilename}`
			);

			return;
		}

		if (this.activeService) {
			// Run the service method with arguments (after `method`).
			return this.activeService[method].apply(
				this.activeService,
				Array.prototype.slice.call(arguments, 1)
			);
		}
	}

	setConfig(config) {
		this.config = config;
		this.restartServiceInstance();
	}

	/**
	 * Set the current service settings based on the contextual URI.
	 * @param {uri} uriContext
	 */
	setSettings(uriContext) {
		const settings = this.getServerJSON(uriContext);

		if (settings) {
			this.settings = settings.data;

			if (settings.newFile) {
				// settings have changed.
				this.restartServiceInstance();
			}

			return settings;
		} else {
			// No settings for this context - show an error
			vscode.window.showErrorMessage(
				`A settings file could not be found within your project. Have you ` +
				`created a file with the name "${this.config.settingsFilename}" yet?`
			);
		}

		return false;
	}

	/**
	 * Check that a textDocument change event is for a valid service settings file
	 * @param {textDocument} textDocument
	 */
	checkServiceSettingsChange(textDocument) {
		if (path.basename(textDocument.uri.path) === this.model.config.settingsFilename) {
			// File being changed is a server config file - regenerate server settings
			this.setServerSettings(textDocument.uri);
		}
	}

	/**
	 * Restarts the currently active service instance
	 */
	restartServiceInstance() {
		if (this.settings) {
			// (Re)instantiate service
			this.activeService = null;

			if (this.settings.service && this.services[this.settings.service]) {
				console.log(`Reinstantiating service provider ${this.settings.service}`);

				this.activeService = new this.services[this.settings.service](
					this.config,
					this.settings[this.settings.service]
				);
			}
		}
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
}

module.exports = Service;