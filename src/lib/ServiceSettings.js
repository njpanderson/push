const vscode = require('vscode');
const fs = require('fs');
const crypto = require('crypto');
const jsonc = require('jsonc-parser');

const Configurable = require('./Configurable');
const ServiceType = require('./ServiceType');
const channel = require('../lib/channel');
const PushError = require('../lib/PushError');
const Paths = require('../lib/Paths');
const utils = require('../lib/utils');
const i18n = require('../lang/i18n');
const constants = require('./constants');

class ServiceSettings extends Configurable {
	constructor(options) {
		super();

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
	 * @returns {string} The file contents.
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
				optionItem: /^([\t]*)(\s*"(.+?)":\s[^$]*)/,
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

	/**
	 * Retrieves the contents of a settings file by locating it within the current
	 * `dir` path or within the path's ancestors.
	 * @param {Uri} dir - The contextual directory in which to begin searching.
	 * @param {string} settingsFileGlob - A glob for the settings file.
	 * @returns {object|null}
	 */
	getServerFile(dir, settingsFileGlob) {
		// Find the settings file
		let uri = this.paths.findFileInAncestors(
			settingsFileGlob,
			dir,
			this.config.limitServiceTraversal
		);

		if (uri !== null && this.paths.fileExists(uri)) {
			// File isn't empty and exists - read and return
			return {
				uri: uri,
				contents: (
					fs.readFileSync(this.paths.getNormalPath(uri), 'utf8')
				).toString().trim()
			};
		}

		return null;
	}

	/**
	 * @description
	 * Attempts to retrieve a server settings JSON file from the supplied URI,
	 * eventually ascending the directory tree to the root of the project.
	 * @param {Uri} uri - URI of the path in which to start looking.
	 * @param {string} settingsFilename - Name of the settings file.
	 * @param {boolean} [quiet=false] - Produce no errors if a settings file couldn't be
	 * found. (Will not affect subsequent errors.)
	 * @param {boolean} [refresh=false] - Set `true` to ensure a fresh copy of the JSON.
	 */
	getServerJSON(uri, settingsFilename, quiet = false, refresh = false) {
		let uriPath, settings, newFile, data, hash, digest;

		if (!this.paths.isDirectory(uri)) {
			// If the path isn't a directory, get its directory name
			uriPath = this.paths.getNormalPath(this.paths.getDirName(uri));
		} else {
			// Otherwise, just get it as-is
			uriPath = this.paths.getNormalPath(uri);
		}

		if (!refresh && this.settingsCache[uriPath]) {
			// Return a cached version
			utils.trace('ServiceSettings#getServerJSON', `Using cached settings for ${uriPath}`);
			this.settingsCache[uriPath].newFile = false;
			return this.settingsCache[uriPath];
		}

		if ((settings = this.getServerFile(uri, settingsFilename))) {
			// File isn't empty and exists - read and set into cache
			try {
				data = this.normalise(
					jsonc.parse(settings.contents),
					settings.uri
				);

				hash = crypto.createHash('sha256');
				hash.update(settings.file + '\n' + settings.contents);
				digest = hash.digest('hex');

				// Check file is new by comparing existing hash
				newFile = (
					!this.settingsCache[uriPath] ||
					digest !== this.settingsCache[uriPath].hash
				);

				// Cache entry, with extra properties
				this.settingsCache[uriPath] = Object.assign({}, settings, {
					newFile,
					data,
					hash: digest
				});

				// Return entry as cached
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

	/**
	 * Adds the current service settings based on the contextual URI to the
	 * passed `merge` object, then returns a new mutated object.
	 * @param {Uri} uriContext - Contextual Uri.
	 * @param {string} settingsGlob - Glob to use for locating the settings file.
	 * @param {object} [merge={}] - Object to merge with.
	 */
	mergeWithServiceSettings(uriContext, settingsGlob, merge = {}) {
		const settings = this.getServerJSON(
			uriContext,
			settingsGlob
		);

		// Make a duplicate to avoid changing the original config
		let newConfig = Object.assign({}, merge);

		if (settings) {
			// Settings retrieved from JSON file within context
			newConfig.env = settings.data.env;
			newConfig.serviceName = settings.data.service;
			newConfig.service = settings.data[newConfig.serviceName];
			newConfig.serviceFile = this.paths.getNormalPath(settings.uri);
			newConfig.serviceUri = settings.uri;
			newConfig.serviceSettingsHash = settings.hash;

			if (newConfig.service && newConfig.service.root) {
				// Expand Windows environment variables
				newConfig.service.root = newConfig.service.root.replace(
					/%([^%]+)%/g,
					function (_, n) {
						return process.env[n] || _;
					}
				);
			}

			return newConfig;
		} else {
			// No settings for this context
			return false;
		}
	}

	/**
	 * Sets the active environment option within a service settings file.
	 * @param {Uri} uri - Uri for the contextual file.
	 * @param {string} settingsFileGlob - Glob to find the settings file.
	 * @returns {Promise} Resolving once the change has been made.
	 */
	setConfigEnv(uri, settingsFileGlob) {
		return new Promise((resolve, reject) => {
			let environments, settings, jsonData;

			// Get the Uri's directory name
			uri = this.paths.getDirName(uri, true);

			// Find the nearest settings file
			if (!(settings = this.getServerFile(uri, settingsFileGlob))) {
				channel.appendLocalisedError('no_service_file', settingsFileGlob);
				return reject();
			}

			// Get JSON from file (as the actual JSON is required, not the computed settings)
			jsonData = jsonc.parse(settings.contents);

			if (!jsonData.env) {
				channel.appendLocalisedError('no_service_env', settings.file);
				return reject();
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
					this.paths.getNormalPath(settings.uri),
					environments[0]
				);

				return reject();
			}

			vscode.window.showQuickPick(
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
						this.paths.getNormalPath(settings.uri),
						settings.newContents,
						'UTF-8'
					);

					if (this.options.onServiceFileUpdate) {
						this.options.onServiceFileUpdate(settings.uri);
					}

					resolve();
				} catch(error) {
					throw new PushError(i18n.t(
						'error_writing_json',
						(error && error.message) || i18n.t('no_error')
					));
				}
			});
		});
	}

	getServerEnvDetail(jsonData, key) {
		switch (jsonData[key].service) {
		case 'SFTP':
			return (jsonData[key].options && (
				jsonData[key].options.host ?
					jsonData[key].options.host + (
						(jsonData[key].options.port ? ':' + jsonData[key].options.port : '')
					) :
					i18n.t('no_host_defined')
			)) || '';

		case 'File':
			return (jsonData[key].options && jsonData[key].options.root) || '';
		}
	}

	/**
	 * Normalises server data into a consistent format.
	 * @param {object} settings - Settings data as retrieved by JSON/C files.
	 * @param {Uri} uri - Uri of the settings file. Mainly for error reporting.
	 */
	normalise(settings, uri) {
		let serviceData, env;

		if (!settings.service) {
			if (settings.env) {
				// env exists - new style of service
				if ((serviceData = settings[settings.env])) {
					settings.service = serviceData.service;
					settings[settings.service] = serviceData.options;

					// Strip out unused environments for safety
					for (env in settings) {
						if (
							settings.hasOwnProperty(env) &&
							env !== 'service' &&
							env !== settings.service &&
							env !== 'env'
						) {
							delete settings[env];
						}
					}
				} else {
					// env defined, but it doesn't exist
					throw new PushError(i18n.t(
						'active_service_not_found',
						settings.env,
						this.paths.getNormalPath(uri)
					));
				}
			} else {
				// No service defined
				throw new PushError(i18n.t(
					'service_not_defined',
					this.paths.getNormalPath(uri)
				));
			}
		}

		if (!settings[settings.service]) {
			// Service defined but no config object found
			throw new PushError(i18n.t(
				'service_defined_but_no_config_exists',
				this.paths.getNormalPath(uri)
			));
		}

		return settings;
	}
}

module.exports = ServiceSettings;
