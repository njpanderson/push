const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jsonc = require('jsonc-parser');

const ServiceType = require('./ServiceType');
const channel = require('../lib/channel');
const PushError = require('../lib/PushError');
const Paths = require('../lib/Paths');
const utils = require('../lib/utils');
const i18n = require('../lang/i18n');
const constants = require('./constants');

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

	/**
	 * Creates the contents for a server settings file.
	 * @param {ServiceType} serviceType - Service type settings instance.
	 * @returns {string} - The file contents.
	 */
	createServerFileContents(serviceType) {
		let content, serviceJSON, serviceJSONLines,
			defaults, requiredOptions, re,
			state, prevState;

		if (!(serviceType instanceof ServiceType)) {
			throw new Error('serviceType argument is not an instance of ServiceType');
		}

		if (serviceType.label !== 'Empty') {
			// Get string based JSON payload from service
			serviceJSON = JSON.stringify(serviceType.settingsPayload, null, '\t');

			// Format according to service defaults
			serviceJSONLines = serviceJSON.split('\n');
			defaults = Object.keys(serviceType.settingsPayload.default.options);
			requiredOptions = Object.keys(serviceType.requiredOptions);

			re = {
				indents: /\t/g,
				indentedLine: /^([\t]+)(.*)$/,
				optionItem: /^([\t]*)(\s*\"(.+?)\":\s[^$]*)/,
				optionCloser: /\t{3,}(]|})/
			};

			state = prevState = {
				line: '',
				indentLevel: 0,
				inOption: false,
				optionCommented: false,
				inCommentedOption: false
			};

			/* Find each line and figure out whether to comment out default options
			 * This isn't the best way of doing this, as it relies heavily on indent
			 * levels and a consistent JSON format, but it works for all of the current
			 * use cases.
			 * TODO: improve with a proper AST parser or the node-jsonc-parser when available.
			 */
			serviceJSONLines = serviceJSONLines.map((line) => {
				let match = line.match(re.optionItem);

				// Set various state options
				state.line = line;
				state.indentLevel = (line.match(re.indents) || []).length;
				state.inOption = state.indentLevel >= 4;
				state.optionCommented = false;

				state.inCommentedOption = (
					state.inOption && prevState.inCommentedOption || (
						prevState.inCommentedOption && re.optionCloser.test(line)
					)
				);

				if ((
					state.indentLevel === 3 &&
					match !== null &&
					defaults.indexOf(match[3]) !== -1 &&
					requiredOptions.indexOf(match[3]) === -1
				) || state.inCommentedOption) {
					// Option is a default and it is not required
					line = line.replace(re.indentedLine, '$1// $2');
					state.optionCommented = true;
					state.inCommentedOption = true;
				}

				prevState = Object.assign({}, state);

				return line;
			});
		}

		// Add comment to the top, then the contents
		content =
			'// ' + i18n.t('comm_push_settings1', (new Date()).toString()) +
			'// ' + i18n.t('comm_push_settings2') +
		((serviceJSON && serviceJSONLines.join('\n')) || constants.DEFAULT_SERVICE_CONFIG);

		return content;
	}

	getServerFile(dir, settingsFilename) {
		// Find the settings file
		let file = this.paths.getNormalPath(this.paths.findFileInAncestors(
			settingsFilename,
			dir
		));

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
					uri: vscode.Uri.file(settings.file),
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
