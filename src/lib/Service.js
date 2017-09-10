const vscode = require('vscode');

const ServiceSFTP = require('../services/SFTP');
const Paths = require('../lib/Paths');
const utils = require('../lib/utils');

class Service {
	constructor() {
		this.getStateProgress = this.getStateProgress.bind(this);

		this.services = {
			SFTP: ServiceSFTP
		};

		this.activeService = null;
		this.paths = new Paths();
		this.config = {};
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

	exec(method, config, args = []) {
		// Set the current service configuration
		this.setConfig(config);

		if (!this.activeService) {
			// Show a service error
			utils.showError(
				`A transfer service was not defined within the settings file` +
				` at ${this.config.settingsFilename}`
			);

			return;
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

	/**
	 * Restarts the currently active service instance
	 */
	restartServiceInstance() {
		// (Re)instantiate service
		this.activeService = null;

		if (this.config.serviceName && this.config.service) {
			console.log(`Instantiating service provider "${this.config.serviceName}"`);

			if (this.activeService) {
				// Run service destructor
				this.activeService.destructor();
			}

			// Instantiate
			this.activeService = new this.services[this.config.serviceName]();

			// Invoke settings validation
			this.activeService.validateServiceSettings(
				this.activeService.serviceValidation,
				this.config.service
			);
		}
	}
}

module.exports = Service;