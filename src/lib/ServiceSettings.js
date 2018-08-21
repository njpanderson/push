const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jsonc = require('jsonc-parser');

const channel = require('../lib/channel');
const PushError = require('../lib/PushError');
const Paths = require('../lib/Paths');
const utils = require('../lib/utils');
const i18n = require('../lang/i18n');

class ServiceSettings {
	constructor(options) {
		this.setOptions(options);
		this.settingsCache = {};
		this.paths = new Paths();
	}

	/**
	 * Set class-specific options (Which have nothing to do with the config).
	 * @param {object} options
	 */
	setOptions(options) {
		this.options = Object.assign({}, {
			onServiceFileUpdate: null
		}, options);
	}

	/**
	 * Completely clear the cache by trashing the old object.
	 */
	clear() {
		this.settingsCache = {};
	}

	getServerFile(dir, settingsFilename) {
		// Find the settings file
		let file = this.paths.findFileInAncestors(
			settingsFilename,
			dir
		);

		if (file !== '' && fs.existsSync(file)) {
			// File isn't empty and exists - read and set into cache
			return {
				file,
				contents: (fs.readFileSync(file, "UTF-8")).toString().trim()
			};
		}

		return null;
	}

	/**
	 * @description
	 * Attempts to retrieve a server settings JSON file from the supplied URI,
	 * eventually ascending the directory tree to the root of the project.
	 * @param {object} uri - URI of the path in which to start looking.
	 * @param {string} settingsFilename - Name of the settings file.
	 * @param {boolean} [quiet=false] - Produce no errors if a settings file couldn't be
	 * found. (Will not affect subsequent errors.)
	 * @param {boolean} [refresh=false] - Set `true` to ensure a fresh copy of the JSON.
	 */
	getServerJSON(uri, settingsFilename, quiet = false, refresh = false) {
		let uriPath = this.paths.getNormalPath(uri),
			settings, newFile, data, hash, digest;

		// If the path isn't a directory, get its directory name
		if (!this.paths.isDirectory(uriPath)) {
			uriPath = path.dirname(uriPath);
		}

		if (!refresh && this.settingsCache[uriPath]) {
			// Return a cached version
			utils.trace('ServiceSettings#getServerJSON', `Using cached settings for ${uriPath}`);
			this.settingsCache[uriPath].newFile = false;
			return this.settingsCache[uriPath];
		}

		if (settings = this.getServerFile(uriPath, settingsFilename)) {
			// File isn't empty and exists - read and set into cache
			try {
				data = this.normalise(
					jsonc.parse(settings.contents),
					settings.file
				);

				hash = crypto.createHash('sha256');
				hash.update(settings.file + '\n' + settings.contents);
				digest = hash.digest('hex');

				// Check file is new by comparing existing hash
				newFile = (
					!this.settingsCache[uriPath] ||
					digest !== this.settingsCache[uriPath].hash
				);

				// Cache entry
				this.settingsCache[uriPath] = {
					file: settings.file,
					fileContents: settings.contents,
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

		if (!quiet) {
			channel.appendLocalisedError('no_service_file', settingsFilename);
		}

		return null;
	}

	setConfigEnv(uri, settingsFilename) {
		return new Promise((resolve, reject) => {
			let uriPath = this.paths.getNormalPath(uri),
				environments, settings, jsonData;

			// If the path isn't a directory, get its directory name
			if (!this.paths.isDirectory(uriPath)) {
				uriPath = path.dirname(uriPath);
			}

			// Find the nearest settings file
			if (settings = this.getServerFile(uriPath, settingsFilename)) {
				// Get JSON from file (as the actual JSON is required, not the computed settings)
				jsonData = jsonc.parse(settings.contents);

				if (!jsonData.env) {
					channel.appendLocalisedError('no_service_env', settings.file);
					reject();
				}

				// Produce prompt for new env
				environments = Object.keys(jsonData).filter(
					(key) => (key !== 'env')
				).map((key) => {
					return {
						label: key,
						description: (key === jsonData.env ? '(selected)' : ''),
						detail: this.getServerEnvDetail(jsonData, key)
					};
				});

				if (!environments.length) {
					channel.appendLocalisedError('no_service_env', settings.file);
					return reject();
				}

				if (environments.length === 1) {
					channel.appendLocalisedError(
						'single_env',
						settings.file,
						environments[0]
					);

					return reject();
				}

				return vscode.window.showQuickPick(
					environments,
					{
						placeHolder: i18n.t('select_env')
					}
				).then((env) => {
					if (env === undefined || env.label === '') {
						return;
					}

					try {
						// Modify JSON document & Write changes
						settings.newContents = jsonc.applyEdits(
							settings.contents,
							jsonc.modify(
								settings.contents,
								['env'],
								env.label,
								{
									formattingOptions: {
										tabSize: 4
									}
								}
							)
						);

						// Write back to the file
						fs.writeFileSync(
							settings.file,
							settings.newContents,
							'UTF-8'
						);

						if (this.options.onServiceFileUpdate) {
							this.options.onServiceFileUpdate(vscode.Uri.file(settings.file))
						}
					} catch(error) {
						throw new PushError(i18n.t(
							'error_writing_json',
							(error && error.message) || i18n.t('no_error')
						))
					}
				});
			}
		});
	}

	getServerEnvDetail(jsonData, key) {
		switch (jsonData[key].service) {
			case "SFTP":
				return (jsonData[key].options && (
					jsonData[key].options.host + (
						(jsonData[key].options.port ? ':' + jsonData[key].options.port : '')
					)
				)) || '';

			case "File":
				return (jsonData[key].options && jsonData[key].options.root) || '';
		}
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
