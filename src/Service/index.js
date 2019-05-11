const vscode = require('vscode');

const ProviderBase = require('../ProviderBase');
const ProviderSFTP = require('./providers/ProviderSFTP');
const ProviderFile = require('./providers/ProviderFile');
const ServiceSettings = require('./ServiceSettings');
const ServiceType = require('./ServiceType');
const PushBase = require('../PushBase');
const Paths = require('../Paths');
const PushError = require('../lib/types/PushError');
const config = require('../lib/config');
const utils = require('../lib/utils');
const logger = require('../lib/logger');
const i18n = require('../i18n');

class Service extends PushBase {
	constructor(options) {
		super();

		utils.trace('Service', 'Begin instantiation', true);

		this.setOptions(options);

		this.services = {
			SFTP: ProviderSFTP,
			File: ProviderFile
		};

		// Create ServiceSettings instance for managing the files
		this.settings = new ServiceSettings({
			serviceList: this.getList(),
			onServiceFileUpdate: this.options.onServiceFileUpdate
		});

		this.getStateProgress = this.getStateProgress.bind(this);

		this.activeService = null;
		this.paths = new Paths();
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
		let options = [],
			service, settingsPayload;

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
	 * Asyncronously invokes a method within the active transfer service.
	 * @param {string} method - Method name to invoke.
	 * @param {object} config - Current configuration state.
	 * @param {array} args - Arguments to send to the method, as an array.
	 * @return {Promise} Return result from the service method.
	 */
	exec(method, config, args = []) {
		// Set the current service configuration
		this.setConfig(config);

		if (!this.config || !this.config.service || !this.activeService) {
			return Promise.reject(new PushError(
				i18n.t('no_service_file', this.config.settingsFileGlob)
			));
		}

		// Set the active service's config
		this.activeService.setConfig(this.config);

		return this.checkEnvSafety()
			.then(() => {
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
			}, (error) => {
				throw error;
			});
	}

	/**
	 * Synchronously invokes a method within the active transfer service.
	 * @param {string} method - Method name to invoke.
	 * @param {object} config - Current configuration state.
	 * @param {array} args - Arguments to send to the method, as an array.
	 * @return {mixed} Return result from the service method.
	 */
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

	/**
	 * @description
	 * Checks that the ENV has had a transfer operation within x seconds, otherwise
	 * will produce a warning dialog.
	 * @returns {Promise} - Resolving if the dialog is either not produced, or
	 * confirmed, rejecting if the dialog is cancelled.
	 */
	checkEnvSafety() {
		const log = logger.get('Service#checkEnvSafety'),
			blurLog = logger.getEvent('windowBlurred');

		let envReminderTimeout = this.getEnvReminderTimeout(),
			age;

		if (blurLog.lastRun() > log.lastRun() && envReminderTimeout > 0) {
			// If vscode was blurred since the last run, halve the timeout.
			envReminderTimeout = (envReminderTimeout / 2);
		}

		if (
			// No environment
			typeof this.config.env === 'undefined' ||
			// Reminder is false
			!this.config.service.reminder ||
			// Task has run and within timeframe
			log.hasRunOnce() && log.runWithin(envReminderTimeout)
		) {
			// Loggable has run within X seconds - log again
			log.add();

			return Promise.resolve();
		} else {
			// Remind the user
			age = log.age();

			return vscode.window.showWarningMessage(
				(
					(age === 0) ?
						i18n.t('service_inactive', this.config.env) :
						i18n.t('service_inactive_x_seconds', this.config.env, Math.round(log.age()))
				),
				{
					modal: true
				},
				{
					id: 'continue',
					title: i18n.t('continue')
				}, {
					id: 'cancel',
					isCloseAffordance: true,
					title: i18n.t('cancel')
				}
			).then((answer) => {
				answer = !!(answer && answer.id === 'continue');

				if (answer) {
					// Log execution
					log.add();

					return true;
				}

				throw new PushError(i18n.t('transfer_cancelled'));
			});
		}
	}

	/**
	 * Returns the configured ENV switch reminder timeout, or a default of 30 seconds.
	 */
	getEnvReminderTimeout() {
		if (
			this.config.service.reminderTimeout !== null &&
			!isNaN(this.config.service.reminderTimeout) &&
			this.config.service.reminderTimeout > 0
		) {
			// Get timeout from service file
			return this.config.service.reminderTimeout;
		}

		if (
			!isNaN(this.config.envReminderTimeout) &&
			this.config.envReminderTimeout > 0
		) {
			// Get workspace timeout
			return this.config.envReminderTimeout;
		}

		// Return the default
		return 30;
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
			ProviderBase.defaults,
			this.services[serviceName].defaults
		);
	}
}

module.exports = Service;
