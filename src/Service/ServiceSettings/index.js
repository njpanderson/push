const vscode = require('vscode');
const fs = require('fs');
const crypto = require('crypto');
const jsonc = require('jsonc-parser');
const micromatch = require('micromatch');

const Configurable = require('../../Configurable');
const ServiceType = require('../ServiceType');
const ServicePromptResult = require('../ServicePromptResult');
const channel = require('../../lib/channel');
const PushError = require('../../lib/types/PushError');
const Paths = require('../../Paths');
const utils = require('../../lib/utils');
const i18n = require('../../i18n');
const constants = require('../../lib/constants');

/**
 * @typedef {object} ServiceSettingsOptions
 * @property {function} onServiceFileUpdate - Invoked whenever a service file is updated.
 */

/**
 * Handles management of server settings
 */
class ServiceSettings extends Configurable {
	/**
	 * Constructor
	 * @param {ServiceSettingsOptions} [options]
	 */
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
			serviceList: [],
			onServiceFileUpdate: null
		}, options);
	}

	/**
	 * Completely clear the cache by trashing the old object.
	 * @param {Uri} [uri] - Optional Uri of cached item to clear.
	 */
	clear(uri) {
		let uriPath = this.paths.getNormalPath(uri);

		if (uriPath && this.settingsCache[uriPath]) {
			this.settingsCache[uriPath];
		} else {
			this.settingsCache = {};
		}
	}

	/**
	 * Imports a configuration file.
	 * @param {Uri} uri - Uri to start looking for a configuration file
	 * @param {string} type - Type of config to import. Currently only 'SSFTP'
	 * is supported.
	 */
	importConfig(uri) {
		let className, basename, instance, settings,
			settingsFilename = this.config.settingsFilename;

		uri = this.paths.getFileSrc(uri);

		if (!(basename = this.paths.getBaseName(uri))) {
			channel.appendLocalisedError('no_import_file');
		}

		// Figure out which config type this is and import
		for (className in constants.CONFIG_FORMATS) {
			if (constants.CONFIG_FORMATS[className].test(basename)) {
				className = require(`../importers/${className}`);
				instance = new className();

				return instance.import(uri)
					.then((result) => {
						settings = result;

						return this.getFileNamePrompt(
							settingsFilename,
							[{ uri: this.paths.getDirName(uri) }],
							true,
							false
						);
					})
					.then((result) => {
						if (result.exists) {
							// Settings file already exists at this location!
							return vscode.window.showInformationMessage(
								i18n.t('settings_file_exists'),
								{
									title: i18n.t('overwrite')
								}, {
									isCloseAffordance: true,
									title: i18n.t('cancel')
								}
							).then((collisionAnswer) => {
								return ({
									uri: result.uri,
									write: (collisionAnswer.title === i18n.t('overwrite'))
								});
							});
						} else {
							// Just create and open
							return ({ uri: result.uri, write: true });
						}
					})
					.then((result) => {
						if (result.write) {
							// Write the file
							this.paths.writeAndOpen(
								'// ' + i18n.t(
									'comm_settings_imported',
									this.paths.getNormalPath(uri)
								) +
								JSON.stringify(settings, null, '\t'),
								result.uri
							);
						}
					})
					.catch((error) => {
						channel.appendError(error);
					});
			}
		}

		channel.appendLocalisedError('import_file_not_supported');
	}

	/**
	 * Edits (or creates) a server configuration file
	 * @param {Uri} uri - Uri to start looking for a configuration file.
	 * @param {boolean} forceCreate - Force servicefile creation. Has no effect
	 * if the service file is level with the contextual file.
	 */
	editServiceConfig(uri, forceCreate) {
		return new Promise((resolve, reject) => {
			let dir, settingsFile;

			uri = this.paths.getFileSrc(uri);
			dir = this.paths.getDirName(uri, true);

			// Find the nearest settings file
			settingsFile = this.paths.findFileInAncestors(
				this.config.settingsFileGlob,
				dir
			);

			/**
			 * If a settings file is found but forceCreate is true, then the file name
			 * prompt path is chosen.
			 *
			 * In the case that a service file exists in the _same_ location as the
			 * contextual file, it will still be edited (due to the logic within
			 * getFileNamePromp() based on resolving immediately unless `forceDialog`
			 * is true. This is intended behaviour as two service files should not
			 * exist within the same folder.
			 */
			if (settingsFile && !forceCreate) {
				// Edit the settings file found
				utils.openDoc(settingsFile)
					.then(resolve, reject);
			} else {
				// Produce a prompt to create a new settings file
				this.getFileNamePrompt(this.config.settingsFilename, [{
					uri: dir
				}])
					.then((file) => {
						if (file.exists) {
							return utils.openDoc(file.uri);
						} else {
							// Create the file
							return this.paths.writeAndOpen(
								this.createServerFileContents(
									file.serviceType
								),
								file.uri
							);
						}
					})
					.then(resolve, reject);
			}
		});
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
			'// ' + i18n.t('comm_push_settings1', (new Date()).toString()) + '\n' +
			'// ' + i18n.t('comm_push_settings2') + '\n' +
			'// ' + i18n.t('comm_push_settings3') + '\n' +
		((serviceJSON && serviceJSONLines.join('\n')) || constants.DEFAULT_SERVICE_CONFIG.replace(
			'{{PLACACEHOLDER_EMPTY_CONFIG}}', i18n.t('comm_add_service_config')
		));

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
			),
			filename;

		if (uri !== null && this.paths.fileExists(uri)) {
			// File isn't empty and exists - read and return
			filename = this.paths.getNormalPath(uri);

			utils.trace(
				'ServiceSettings#getServerFile',
				`Service file found at ${filename}`
			);

			return {
				uri: uri,
				contents: (
					fs.readFileSync(filename, 'utf8')
				).toString().trim()
			};
		}

		return null;
	}

	/**
	 * Returns whether or not the supplied Uri is that of a settings file
	 * @param {Uri} uri
	 * @returns {boolean}
	 */
	isSettingsFile(uri) {
		return micromatch.isMatch(
			this.paths.getBaseName(uri),
			this.config.settingsFileGlob, {
				basename: true
			}
		);
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
		let uriPath, settings, data, hash, digest;

		if (!this.paths.isDirectory(uri)) {
			// If the path isn't a directory, get its directory name
			uriPath = this.paths.getNormalPath(this.paths.getDirName(uri));
		} else {
			// Otherwise, just get it as-is
			uriPath = this.paths.getNormalPath(uri);
		}

		if (!refresh && (settings = this.getCachedSetting(uriPath))) {
			// Return a cached version
			utils.trace(
				'ServiceSettings#getServerJSON',
				`Using cached settings for ${uriPath}`
			);

			return settings;
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

				// Cache entry with extra properties and return
				return this.addCachedSetting(uriPath, Object.assign({}, settings, {
					data,
					hash: digest
				}));
			} catch(error) {
				if (!quiet) {
					channel.appendError(error.message);
				}

				return null;
			}
		}

		if (!quiet) {
			channel.appendLocalisedError('no_service_file', settingsFilename);
		}

		return null;
	}

	getCachedSetting(uriPath) {
		if (this.settingsCache[uriPath]) {
			this.settingsCache[uriPath].newFile = false;
			return this.settingsCache[uriPath];
		}

		return false;
	}

	addCachedSetting(uriPath, settings) {
		this.settingsCache[uriPath] = settings;
		this.settingsCache[uriPath].newFile = true;
		return this.settingsCache[uriPath];
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
				// There's no "env" property in the JSON
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
					environments[0].label
				);

				return reject();
			}

			// Show the picker to choose an environment
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

					// Clear the cached settings for this path
					this.clear(settings.uri);

					// Fire callback
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
	 * Produce a settings filename prompt.
	 * @param {string} exampleFileName - Filename example to start with.
	 * @param {vscode.WorkspaceFolder[]} folders - A list of workspace folders to
	 * choose from.
	 * @param {boolean} forceDialog - Force a name prompt if the file exists already.
	 * If `false`, will not display a dialog even if the file exists.
	 * @param {boolean} fromTemplate - Produce a list of service templates with which
	 * to fill the file.
	 * @returns {Promise.ServicePromptResult} Resolving to an instance of
	 * ServicePromptResult with the relevant properties.
	 */
	getFileNamePrompt(exampleFileName, folders, forceDialog = false, fromTemplate = true) {
		return new Promise((resolve, reject) => {
			// Produce a filename prompt
			utils.getRootPathPrompt(folders)
				.then((rootUri) => {
					let uri;

					if (!rootUri) {
						return reject();
					}

					uri = this.paths.join(rootUri, exampleFileName);

					// File exists but forceDialog is false - just keep going
					if (this.paths.fileExists(uri) && !forceDialog) {
						return resolve(new ServicePromptResult(uri));
					}

					// Show a prompt, asking the user where the settings file should go
					vscode.window.showInputBox({
						prompt: i18n.t('enter_service_settings_filename'),
						value: uri.fsPath
					}).then((fileName) => {
						let uri = vscode.Uri.file(fileName);

						if (!uri) {
							return reject();
						}

						// Show a service type picker (unless fromTemplate is false)
						if (!fromTemplate) {
							return resolve(new ServicePromptResult(uri));
						}

						return vscode.window.showQuickPick(
							[new ServiceType(
								i18n.t('empty'),
								i18n.t('empty_template')
							)].concat(this.options.serviceList),
							{
								placeHolder: i18n.t('select_service_type_template')
							}
						).then((serviceType) => {
							if (!serviceType) {
								return reject();
							}

							resolve(new ServicePromptResult(
								uri,
								serviceType
							));
						});
					});
				})
				.catch(reject);
		});
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
