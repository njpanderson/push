const ServiceSFTP = require('../services/SFTP');
const ServiceFile = require('../services/File');
const Paths = require('../lib/Paths');

class Service {
	constructor(options) {
		this.setOptions(options);

		this.getStateProgress = this.getStateProgress.bind(this);

		this.services = {
			SFTP: ServiceSFTP,
			File: ServiceFile
		};

		this.activeService = null;
		this.paths = new Paths();
		this.config = {};
	}

	setOptions(options) {
		this.options = Object.assign({}, {
			onDisconnect: null
		}, options);
	}

	setConfig(config) {
		let restart = (config.serviceName !== this.config.serviceName);

		this.config = config;

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
	 */
	exec(method, config, args = []) {
		// Set the current service configuration
		this.setConfig(config);

		if (!this.activeService) {
			// Show a service error
			throw new Error(
				`A transfer service was not defined within the settings file` +
				` at ${this.config.settingsFilename}`
			);
		}

		if (this.activeService) {
			// Set the active service's config
			this.activeService.setConfig(this.config);

			// Run the service method with supplied arguments
			return this.activeService[method].apply(
				this.activeService,
				args
			);
		}
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
			console.log(`Instantiating service provider "${this.config.serviceName}"`);

			// Instantiate
			this.activeService = new this.services[this.config.serviceName]({
				onDisconnect: this.options.onDisconnect
			});

			// Invoke settings validation
			this.activeService.validateServiceSettings(
				this.activeService.serviceValidation,
				this.config.service
			);
		}
	}
}

module.exports = Service;