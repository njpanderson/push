const vscode = require('vscode');

class ServiceBase {
	constructor() {
		this.type = '';
		this.progress = null;
		this.serviceDefaults = {};
		this.config = {};
	}

	destructor() {
		this.config = null;
	}

	setProgress(state) {
		this.progress = state || null;
	}

	/**
	 * Sets the current configuration for the service, merging the defaults with it if set.
	 * @param {object} config
	 */
	setConfig(config) {
		this.config = config;

		if (this.config.service) {
			// Merge service specific default options
			this.config.service = this.mergeWithDefaults(
				this.config.service
			);
		}
	}

	/**
	 * Merges the service specific default settings with supplied object
	 * @param {object} settings
	 */
	mergeWithDefaults(settings) {
		return Object.assign({}, this.serviceDefaults, settings);
	}

	/**
	 * Validates the supplied `settings` object against `spec` specification.
	 * @param {object} spec - Settings specification.
	 * @param {*} settings - Settings to be validated.
	 * @returns {boolean} `true` if the settings are valid, `false` otherwise.
	 */
	validateServiceSettings(spec, settings) {
		let key;

		for (key in spec) {
			if (spec.hasOwnProperty(key)) {
				if (!settings[key]) {
					this.showError(
						`Service setting file for type ${this.type} missing required setting: "${key}".` +
						` Please resolve before continuing.`
					);
					return false;
				}
			}
		}

		return true;
	}

	showError(error) {
		if (typeof error !== "string") {
			error = error.message;
		}

		vscode.window.showErrorMessage(`${this.type}: ${error}`);
	}

	/**
	 * Base service file upload method.
	 * @param {string} src - File source path
	 * @param {string} dest - File destination path
	 */
	put() {
		throw new Error('Service #put method is not yet defined.');
	}

	/**
	 * Base service file download method.
	 * @param {string} src - File source path
	 * @param {string} dest - File destination path
	 */
	get() {
		throw new Error('Service #get method is not yet defined.');
	}
};

module.exports = ServiceBase;