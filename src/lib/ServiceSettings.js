const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jsonc = require('jsonc-parser');

const channel = require('../lib/channel');
const PushError = require('../lib/PushError');
const Paths = require('../lib/Paths');
const i18n = require('../lang/i18n');

class ServiceSettings {
	constructor() {
		this.settingsCache = {};
		this.paths = new Paths();
	}

	/**
	 * Completely clear the cache by trashing the old object.
	 */
	clear() {
		this.settingsCache = {};
	}

	/**
	 * @description
	 * Attempts to retrieve a server settings JSON file from the supplied URI,
	 * eventually ascending the directory tree to the root of the project.
	 * @param {object} uri - URI of the path in which to start looking.
	 * @param {string} settingsFilename - Name of the settings file.
	 * @param {boolean} [quiet=false] - Produce no errors if a settings file couldn't be
	 * found. (Will not affect subsequent errors.)
	 */
	getServerJSON(uri, settingsFilename, quiet = false) {
		let uriPath = this.paths.getNormalPath(uri),
			settingsFile, fileContents, newFile, data, hash, digest;

		// If the path isn't a directory, get its directory name
		if (!this.paths.isDirectory(uriPath)) {
			uriPath = path.dirname(uriPath);
		}

		if (this.settingsCache[uriPath]) {
			// Return a cached version
			this.settingsCache[uriPath].newFile = false;
			return this.settingsCache[uriPath];
		}

		// Find the settings file
		settingsFile = this.paths.findFileInAncestors(
			settingsFilename,
			uriPath
		);

		if (settingsFile !== '' && fs.existsSync(settingsFile)) {
			// File isn't empty and exists - read and set into cache
			fileContents = (fs.readFileSync(settingsFile, "UTF-8")).toString().trim();

			if (fileContents !== '') {
				try {
					data = this.normalise(
						jsonc.parse(fileContents),
						settingsFile
					);

					hash = crypto.createHash('sha256');
					hash.update(settingsFile + '\n' + fileContents);
					digest = hash.digest('hex');

					// Check file is new by comparing existing hash
					newFile = (
						!this.settingsCache[uriPath] ||
						digest !== this.settingsCache[uriPath].hash
					);

					// Cache entry
					this.settingsCache[uriPath] = {
						file: settingsFile,
						fileContents,
						newFile,
						data,
						hash: digest
					};

					return this.settingsCache[uriPath];
				} catch(error) {
					channel.appendError(error.message);
					return null;
				}
			}
		}

		if (!quiet) {
			channel.appendLocalisedError('no_service_file', settingsFilename);
		}

		return null;
	}

	/**
	 * Normalises server data into a consistent format.
	 * @param {object} settings - Settings data as retrieved by JSON/C files
	 */
	normalise(settings, filename) {
		let serviceData, variant;

		if (!settings.service) {
			if (settings.env) {
				// env exists - new style of service
				if ((serviceData = settings[settings.env])) {
					settings.service = serviceData.service;
					settings[settings.service] = serviceData.options;

					// Strip out service variants (to ensure they don't make it to Push)
					for (variant in settings) {
						if (
							settings.hasOwnProperty(variant) &&
							variant !== 'service' &&
							variant !== settings.service &&
							variant !== "env"
						) {
							delete settings[variant];
						}
					}
				} else {
					// env defined, but it doesn't exist
					throw new PushError(i18n.t(
						'active_service_not_found',
						settings.env,
						filename
					));
				}
			} else {
				// No service defined
				throw new PushError(i18n.t(
					'service_not_defined',
					filename
				));
			}
		}

		if (!settings[settings.service]) {
			// Service defined but no config object found
			throw new PushError(i18n.t(
				'service_defined_but_no_config_exists',
				filename
			));
		}

		return settings;
	}
}

module.exports = ServiceSettings;
