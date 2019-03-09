const vscode = require('vscode');
const fs = require('fs');
const crypto = require('crypto');
const jsonc = require('jsonc-parser');
const micromatch = require('micromatch');
const merge = require('lodash/merge');

const Configurable = require('../../Configurable');
const ServiceType = require('../ServiceType');
const ServicePromptResult = require('../ServicePromptResult');
const ServiceDirectory = require('../ServiceDirectory');
const channel = require('../../lib/channel');
const paths = require('../../lib/paths');
const PushError = require('../../lib/types/PushError');
const utils = require('../../lib/utils');
const i18n = require('../../i18n');
const SettingsUI = require('./SettingsUI');

const {
	CONFIG_FORMATS,
	DEFAULT_SERVICE_CONFIG,
	FIELDS
} = require('../../lib/constants/static');

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

		this.directory = new ServiceDirectory();
		this.ui = new SettingsUI(this);
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
		let uriPath = paths.getNormalPath(uri);

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

		uri = paths.getFileSrc(uri);

		if (!(basename = paths.getBaseName(uri))) {
			channel.appendLocalisedError('no_import_file');
		}

		// Figure out which config type this is and import
		for (className in CONFIG_FORMATS) {
			if (CONFIG_FORMATS[className].test(basename)) {
				className = require(`../importers/${className}`);
				instance = new className();

				return instance.import(uri)
					.then((result) => {
						settings = result;

						return this.getFileNamePrompt(
							settingsFilename,
							[{ uri: paths.getDirName(uri) }],
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
							paths.writeAndOpen(
								'// ' + i18n.t(
									'comm_settings_imported',
									paths.getNormalPath(uri)
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
		uri = paths.getFileSrc(uri);

		return new Promise((resolve, reject) => {
			const dir = paths.getDirName(uri, true);

			// Find the nearest settings file
			const settingsFile = paths.findFileInAncestors(
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
				this.ui.show(settingsFile)
					.then(resolve, reject);
				// utils.openDoc(settingsFile)
				// 	.then(resolve, reject);
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
							return paths.writeAndOpen(
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
		let serviceJSON, serviceJSONLines,
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
				const match = line.match(re.optionItem);

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
		const content =
			'// ' + i18n.t('comm_push_settings1', (new Date()).toString()) + '\n' +
			'// ' + i18n.t('comm_push_settings2') + '\n' +
			'// ' + i18n.t('comm_push_settings3') + '\n' +
		((serviceJSON && serviceJSONLines.join('\n')) || DEFAULT_SERVICE_CONFIG.replace(
			'{{PLACACEHOLDER_EMPTY_CONFIG}}', i18n.t('comm_add_service_config')
		));

		return content;
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

		if (!paths.isDirectory(uri)) {
			// If the path isn't a directory, get its directory name
			uriPath = paths.getNormalPath(paths.getDirName(uri));
		} else {
			// Otherwise, just get it as-is
			uriPath = paths.getNormalPath(uri);
		}

		if (!refresh && (settings = this.getCachedSettings(uriPath))) {
			// Return a cached version
			utils.trace(
				'ServiceSettings#getServerJSON',
				`Using cached settings for ${uriPath}`
			);

			return settings;
		}

		if ((settings = this.findServerFile(uri, settingsFilename))) {
			// File isn't empty and exists - read and set into cache
			try {
				data = this.parseServerFileContent(settings.contents, settings.uri);

				hash = crypto.createHash('sha256');
				hash.update(settings.file + '\n' + settings.contents);
				digest = hash.digest('hex');

				// Cache entry with extra properties and return
				return this.addCachedSettings(uriPath, Object.assign({}, settings, {
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

	getCachedSettings(uriPath) {
		if (this.settingsCache[uriPath]) {
			this.settingsCache[uriPath].newFile = false;
			return this.settingsCache[uriPath];
		}

		return false;
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
	 * Retrieves the raw contents of a settings file at the specified Uri.
	 * @param {Uri} uri - File Uri.
	 */
	getServerFile(uri) {
		const filename = paths.getNormalPath(uri);

		utils.trace(
			'ServiceSettings#getServerFile',
			`Service file read at ${filename}`
		);

		return fs.readFileSync(filename, 'utf8').toString().trim();
	}

	addCachedSettings(uriPath, settings) {
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
		const newConfig = Object.assign({}, merge);

		if (settings) {
			// Settings retrieved from JSON file within context
			newConfig.env = settings.data.env;
			newConfig.serviceName = settings.data.service;
			newConfig.service = settings.data[newConfig.serviceName];
			newConfig.serviceFile = paths.getNormalPath(settings.uri);
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
			let environments, settings;

			// Get the Uri's directory name
			uri = paths.getDirName(uri, true);

			// Find the nearest settings file
			if (!(settings = this.findServerFile(uri, settingsFileGlob))) {
				channel.appendLocalisedError('no_service_file', settingsFileGlob);
				return reject();
			}

			// Get JSON from file (as the actual JSON is required, not the computed settings)
			const jsonData = this.parseServerFileContent(
				settings.content,
				uri,
				false
			);

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
					paths.getNormalPath(settings.uri),
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
						paths.getNormalPath(settings.uri),
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

					uri = paths.join(rootUri, exampleFileName);

					// File exists but forceDialog is false - just keep going
					if (paths.fileExists(uri) && !forceDialog) {
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
	 * Get the options schema for a service.
	 * @param {string} service - Service key as defined in ServiceDirectory.services.
	 */
	getServiceSchema(service) {
		return this.directory.getSchema(service);
	}

	/**
	 * Get the options schema for all currently available services.
	 */
	getAllServiceSchemas() {
		const result = {};

		let service;

		for (service in ServiceDirectory.services) {
			result[service] = this.getServiceSchema(service);
		}

		return result;
	}

	/**
	 * Retrieves the contents of a settings file by locating it within the current
	 * `dir` path or within the path's ancestors.
	 * @param {Uri} dir - The contextual directory in which to begin searching.
	 * @param {string} settingsFileGlob - A glob for the settings file.
	 * @returns {object|null}
	 */
	findServerFile(dir, settingsFileGlob) {
		// Find the settings file
		const uri = paths.findFileInAncestors(
			settingsFileGlob,
			dir,
			this.config.limitServiceTraversal
		);

		if (uri !== null && paths.fileExists(uri)) {
			// File isn't empty and exists - read and return
			return {
				uri: uri,
				contents: this.getServerFile(uri)
			};
		}

		return null;
	}

	/**
	 * Returns whether or not the supplied Uri is that of a settings file
	 * @param {Uri} uri
	 * @returns {boolean}
	 */
	isServerFile(uri) {
		return micromatch.isMatch(
			paths.getBaseName(uri),
			this.config.settingsFileGlob, {
				basename: true
			}
		);
	}

	/**
	 * Retrieves and parses a server file.
	 * @param {Uri} uri - File Uri.
	 * @param {boolean} [normalise=true] - Normalise the file.
	 * @returns {object} An object definition of the file contents.
	 */
	parseServerFile(uri, normalise = true) {
		return this.parseServerFileContent(
			this.getServerFile(uri),
			uri,
			normalise
		);
	}

	/**
	 * Retrieves and parses server file content
	 * @param {string} content - File contents.
	 * @param {Uri} uri - File Uri. (Used for error reporting by ServiceSettings#normalise).
	 * @param {boolean} [normalise=true] - Normalise the file.
	 * @returns {object} An object definition of the file contents.
	 */
	parseServerFileContent(content, uri, normalise = true) {
		let key, schema;
		const settings = jsonc.parse(content);

		for (key in settings) {
			if (
				settings.hasOwnProperty(key) &&
				key !== 'env' &&
				settings[key].options &&
				(schema = this.getServiceSchema(settings[key].service))
			) {
				settings[key].options = this.setValueTypes(
					schema,
					settings[key].options
				);
			}
		}

		return normalise ? this.normaliseServerSettings(settings, uri, normalise) : settings;
	}

	/**
	 * Parses a server settings file, setting the correct types for each value
	 * @param {array} schema - Schema to check settings against.
	 * @param {object} settings - Server settings to parse.
	 */
	setValueTypes(schema, settings) {
		schema.forEach((field) => {
			if (!settings.hasOwnProperty(field.name)) {
				// Setting doesn't exist - possibly make default and return
				if (field.default) {
					settings[field.name] = field.default;
				}

				return;
			}

			switch (field.type) {
			case FIELDS.NUMBER:
				settings[field.name] = parseFloat(settings[field.name]);
				break;

			case FIELDS.GRID:
				settings[field.name].forEach((row) => {
					row = this.setValueTypes(
						field.fields,
						row
					);
				});
				break;

			case FIELDS.FIELDSET:
				settings[field.name] = this.setValueTypes(
					field.fields,
					settings[field.name]
				);
			}
		});

		return settings;
	}

	/**
	 * Normalises server data into a consistent format.
	 * @param {object} settings - Settings data as retrieved by JSON/C files.
	 * @param {Uri} uri - Uri of the settings file. Mainly for error reporting.
	 * @param {string} [normaliseStyle='single'] - One of 'single' or 'array'.
	 * @returns {object} Either an object containing a single servce settings
	 * based on the active environment, or an object containing array data of
	 * environments.
	 */
	normaliseServerSettings(settings, uri, normaliseStyle) {
		let serviceData, env;

		settings = merge({}, settings);

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
						paths.getNormalPath(uri)
					));
				}
			} else {
				// No service defined
				throw new PushError(i18n.t(
					'service_not_defined',
					paths.getNormalPath(uri)
				));
			}
		}

		if (!settings[settings.service]) {
			// Service defined but no config object found
			throw new PushError(i18n.t(
				'service_defined_but_no_config_exists',
				paths.getNormalPath(uri)
			));
		}

		return settings;
	}
}

module.exports = ServiceSettings;
