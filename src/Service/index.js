const ServiceDirectory = require('./ServiceDirectory');
const ServiceSettings = require('./ServiceSettings');
const PushBase = require('../PushBase');
const PushError = require('../lib/types/PushError');
const config = require('../lib/config');
const utils = require('../lib/utils');
const i18n = require('../i18n');
const paths = require('../lib/paths');

class Service extends PushBase {
	constructor(options) {
		super();

		utils.trace('Service', 'Begin instantiation', true);

		this.setOptions(options);

		this.directory = new ServiceDirectory();

		// Create ServiceSettings instance for managing the files
		this.settings = new ServiceSettings({
			serviceList: this.directory.getQuickPickList(),
			onServiceFileUpdate: this.options.onServiceFileUpdate
		});

		this.getStateProgress = this.getStateProgress.bind(this);

		this.activeService = null;
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
		const restart =
			typeof configObject !== 'undefined' &&
			configObject.serviceName !== this.config.serviceName;

		utils.trace(
			'Service#setConfig',
			`Service config setting${restart ? ' (restarting service)' : ''}`
		);

		/**
		 * Check serviceName is correct.
		 * Done here instead of within ServiceSettings as this class knows
		 * more about the available services.
		 */
		if (configObject && !ServiceDirectory.services[configObject.serviceName]) {
			// Service doesn't exist - return null and produce error
			throw new PushError(i18n.t(
				'service_name_invalid',
				configObject.serviceName,
				paths.getNormalPath(configObject.serviceUri)
			));
		}

		this.config = Object.assign({}, config.get(), configObject);

		if (restart) {
			// Service name is different or set - instantiate.
			this.restartServiceInstance();
		}
	}

	getStateProgress() {
		return this.activeService && this.activeService.progress || null;
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
		const result = this.activeService[method].apply(
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
			this.activeService = new ServiceDirectory.services[this.config.serviceName](
				{
					onDisconnect: this.options.onDisconnect
				},
				this.directory.getServiceSchemaValues(this.config.serviceName),
				this.directory.getServiceSchemaValues(this.config.serviceName, 'required')
			);
		}
	}
}

module.exports = Service;
