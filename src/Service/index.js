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

			settingsPayload.default.options = this.getServiceSchemaValues(service);

			options.push(new ServiceType(
				service,
				this.services[service].description,
				this.services[service].detail,
				settingsPayload,
				this.getServiceSchemaValues(service, 'required')
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
			return Promise.reject(new PushError(
				i18n.t('no_service_file', this.config.settingsFileGlob)
			));
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
				this.getServiceSchemaValues(this.config.serviceName),
				this.getServiceSchemaValues(this.config.serviceName, 'required')
			);
		}
	}

	/**
	 * Get the default settings for a service, extended from the base defaults
	 * @param {string} serviceName - Name of the service to retrieve defaults for.
	 */
	getServiceSchemaValues(serviceSchema, key = 'default') {
		const values = {};

		if (typeof serviceSchema === 'string') {
			serviceSchema = this.services[serviceSchema].optionSchema;
		}

		// Get default values for each key from the options object
		Object.entries(serviceSchema).forEach((option) => {
			if (key === 'required' && option[1][key]) {
				// Getting required value
				values[option[0]] = true;
			} else if (key !== 'required') {
				// Getting default values
				values[option[0]] = option[1][key] || '';
			}

			if (
				option[1].fields &&
				(key !== 'required' || (key === 'required' && values[option[0]]))
			) {
				// Nested fields — recurse and collect further items.
				values[option[0]] = this.getServiceSchemaValues(
					option[1].fields,
					key
				);
			}
		});

		return values;
	}
}

module.exports = Service;
