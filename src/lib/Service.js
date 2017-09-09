const vscode = require('vscode');

const ServiceSFTP = require('../services/SFTP');
const Paths = require('../lib/Paths');

class Service {
	constructor() {
		this.services = {
			SFTP: ServiceSFTP
		};

		this.activeService = null;
		this.paths = new Paths();
	}

	exec(method, config, args = []) {
		if (!this.activeService) {
			// Show a service error
			vscode.window.showErrorMessage(
				`A transfer service was not defined within the settings file` +
				` at ${this.config.settingsFilename}`
			);

			return;
		}

		if (this.activeService) {
			// Run the service method with arguments (after `method`).
			this.activeService.setConfig(config);

			if (this.activeService.config.service) {
				this.activeService.config.service = this.activeService.mergeWithDefaults(
					this.activeService.config.service
				);
			}

			return this.activeService[method].apply(
				this.activeService,
				args
			);
		}
	}

	/**
	 * Restarts the currently active service instance
	 */
	restartServiceInstance(config) {
		// (Re)instantiate service
		this.activeService = null;

		if (config.serviceName && config.service) {
			console.log(`Reinstantiating service provider ${config.serviceName}`);

			if (this.activeService) {
				this.activeService.destructor();
			}

			// Instantiate
			this.activeService = new this.services[config.serviceName]();

			// Invoke settings validation
			this.activeService.validateServiceSettings(
				this.activeService.serviceValidation,
				config.service
			);
		}
	}
}

module.exports = Service;