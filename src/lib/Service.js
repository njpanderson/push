const vscode = require('vscode');

const ServiceBase = require('../services/Base');
const ServiceSFTP = require('../services/SFTP');
const ServiceFile = require('../services/File');
const ServiceSettings = require('./ServiceSettings');
const ServicePromptResult = require('./ServicePromptResult');
const ServiceType = require('./ServiceType');
const PushBase = require('./PushBase');
const Paths = require('./Paths');
const PushError = require('./PushError');
const config = require('./config');
const channel = require('./channel');
const constants = require('./constants');
const utils = require('./utils');
const i18n = require('../lang/i18n');

class Service extends PushBase {
	constructor(options) {
		super();

		this.setOptions(options);

		// Create ServiceSettings instance for managing the files
		this.settings = new ServiceSettings({
			onServiceFileUpdate: this.options.onServiceFileUpdate
		});

		this.getStateProgress = this.getStateProgress.bind(this);

		this.services = {
			SFTP: ServiceSFTP,
			File: ServiceFile
		};

		this.activeService = null;
		this.paths = new Paths();
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
				this.openDoc(settingsFile)
					.then(resolve, reject);
			} else {
				// Produce a prompt to create a new settings file
				this.getFileNamePrompt(this.config.settingsFilename, [{
					uri: dir
				}])
					.then((file) => {
						if (file.exists) {
							return this.openDoc(file.uri);
						} else {
							// Create the file
							return this.writeAndOpen(
								this.settings.createServerFileContents(
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
	 * Sets the current server config environment.
	 * @param {Uri} uri - Contextual Uri for the related file.
	 * @see ServiceSettings#setConfigEnv
	 */
	setConfigEnv(uri) {
		return this.settings.setConfigEnv(uri, this.config.settingsFileGlob);
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
				className = require(`./importers/${className}`);
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
							this.writeAndOpen(
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
	 * Produce a settings filename prompt.
	 * @param {string} exampleFileName - Filename example to start with.
	 * @param {vscode.WorkspaceFolder[]} folders - A list of workspace folders to
	 * choose from.
	 * @param {boolean} forceDialog - Force a name prompt if the file exists already.
	 * If `false`, will not display a dialog even if the file exists.
	 * @param {boolean} fromTemplate - Produce a list of service templates with which
	 * to fill the file.
	 * @returns {Promise<ServicePromptResult} Resolving to an instance of
	 * ServicePromptResult with the relevant properties.
	 */
	getFileNamePrompt(exampleFileName, folders, forceDialog = false, fromTemplate = true) {
		return new Promise((resolve, reject) => {
			// Produce a filename prompt
			this.getRootPathPrompt(folders)
				.then((rootUri) => {
					let uri;

					if (!rootUri) {
						return reject();
					}

					uri = this.paths.join(rootUri, exampleFileName);

					// File exists but forceDialog is false - just keep going
					if (this.paths.fileExists(uri) && !forceDialog) {
						return resolve(ServicePromptResult(uri));
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
							)].concat(this.getList()),
							{
								placeHolder: i18n.t('select_service_type_template')
							}
						).then((serviceType) => {
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
	 * Set class-specific options (Which have nothing to do with the config).
	 * @param {object} options
	 */
	setOptions(options) {
		this.options = Object.assign({}, {
			onDisconnect: null,
			onServiceFileUpdate: null
		}, options);
	}

	/**
	 * Produce a list of the services available, for use within a QuickPick dialog.
	 * @return {ServiceType[]} List of the services, including default settings payloads.
	 */
	getList() {
		let options = [], service, settingsPayload;

		for (service in this.services) {
			settingsPayload = {
				'env': 'default',
				'default': {
					service
				}
			};

			settingsPayload.default.options = this.getServiceDefaults(service);

			options.push(new ServiceType(
				service,
				this.services[service].description,
				this.services[service].detail,
				settingsPayload,
				this.services[service].required
			));
		}

		return options;
	}

	/**
	 * @description
	 * Similar to base setConfig but allows a mutated config including ad-hoc
	 * service settings. Used primarily with Service#exec to invoke service
	 * specific methods with a service augmented config.
	 *
	 * If the serviceName setting changes, this function will also trigger a
	 * restart of the service instance.
	 * @param {object} [configObject] - optional config set to apply.
	 */
	setConfig(configObject) {
		let restart = (
			typeof configObject !== 'undefined' &&
			configObject.serviceName !== this.config.serviceName
		);

		utils.trace(
			'Service#setConfig',
			`Service config setting${restart ? ' (restarting service)' : ''}`
		);

		/**
		 * Check serviceName is correct.
		 * Done here instead of within ServiceSettings as this class knows
		 * more about the available services.
		 */
		if (configObject && !this.services[configObject.serviceName]) {
			// Service doesn't exist - return null and produce error
			throw new PushError(i18n.t(
				'service_name_invalid',
				configObject.serviceName,
				this.paths.getNormalPath(configObject.serviceUri)
			));
		}

		this.config = Object.assign({}, config.get(), configObject);

		if (restart) {
			// Service name is different or set - instantiate.
			this.restartServiceInstance();
		}
	}

	getStateProgress() {
		return (this.activeService && this.activeService.progress) || null;
	}

	/**
	 * Invokes a method within the active transfer service.
	 * @param {string} method - Method name to invoke.
	 * @param {object} config - Current configuration state.
	 * @param {array} args - Arguments to send to the method, as an array.
	 * @return {mixed} Return result from the service method.
	 */
	exec(method, config, args = []) {
		// Set the current service configuration
		this.setConfig(config);

		if (!this.config || !this.config.service || !this.activeService) {
			return Promise.reject();
		}

		// Set the active service's config
		this.activeService.setConfig(this.config);

		// Run the service method with supplied arguments
		let result = this.activeService[method].apply(
			this.activeService,
			args
		);

		if (!(result instanceof Promise)) {
			throw new Error(
				`Method ${method} does not return a Promise. This method cannot ` +
				'be used with exec(). Try execSync()?'
			);
		}

		return result;
	}

	execSync(method, config, args = []) {
		// Set the current service configuration
		this.setConfig(config);

		if (!this.config || !this.config.service || !this.activeService) {
			return false;
		}

		// Set the active service's config
		this.activeService.setConfig(this.config);

		// Run the service method with supplied arguments
		return this.activeService[method].apply(
			this.activeService,
			args
		);
	}

	stop() {
		if (this.activeService) {
			return new Promise((resolve, reject) => {
				this.activeService.stop()
					.then(() => {
						resolve(this.activeService.type);
					})
					.catch(reject);
			});
		} else {
			return Promise.reject();
		}
	}

	/**
	 * Restarts the currently active service instance
	 */
	restartServiceInstance() {
		if (this.config.serviceName && this.config.service) {
			if (this.activeService) {
				// Run service destructor
				this.activeService.destructor();
			}

			this.activeService = null;
			this.startServiceInstance();
		}
	}

	startServiceInstance() {
		if (this.config.serviceName && this.config.service) {
			utils.trace(
				'Service#startServiceInstance',
				`Instantiating service provider "${this.config.serviceName}"`
			);

			// Instantiate service
			this.activeService = new this.services[this.config.serviceName](
				{
					onDisconnect: this.options.onDisconnect
				},
				this.getServiceDefaults(this.config.serviceName),
				this.services[this.config.serviceName].required
			);
		}
	}

	/**
	 * Get the default settings for a service, extended from the base defaults
	 * @param {string} serviceName - Name of the service to retrieve defaults for.
	 */
	getServiceDefaults(serviceName) {
		return Object.assign({},
			ServiceBase.defaults,
			this.services[serviceName].defaults
		);
	}
}

module.exports = Service;
