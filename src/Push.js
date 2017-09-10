const vscode = require('vscode');

const ServiceSettings = require('./lib/ServiceSettings');
const Service = require('./lib/Service');
const Paths = require('./lib/Paths');
const Queue = require('./lib/Queue');
const utils = require('./lib/utils');

/**
 * Provides a normalised interface for the command panel and contextual menus.
 */
class Push {
	constructor() {
		this.upload = this.upload.bind(this);
		this.download = this.download.bind(this);
		this.setConfig = this.setConfig.bind(this);
		this.execUploadQueue = this.execUploadQueue.bind(this);
		this.didSaveTextDocument = this.didSaveTextDocument.bind(this);

		this.settings = new ServiceSettings();
		this.service = new Service();
		this.paths = new Paths();

		this.config = null;

		this.queues = {};

		// Set initial config
		this.setConfig();

		// Create event handlers
		vscode.workspace.onDidChangeConfiguration(this.setConfig);
		vscode.workspace.onDidSaveTextDocument(this.didSaveTextDocument);
	}

	setConfig() {
		this.config = Object.assign({}, vscode.workspace.getConfiguration(
			'njpPush',
			vscode.window.activeTextEditor &&
				vscode.window.activeTextEditor.document.uri
		));
		console.log(`Config set. testConfigItem: "${this.config.testConfigItem}"`);
	}

	/**
	 * Handle text document save events
	 * @param {textDocument} textDocument
	 */
	didSaveTextDocument(textDocument) {
		const settings = this.settings.getServerJSON(
				textDocument.uri,
				this.config.settingsFilename
		);

		if (settings) {
			// File being changed is a within a service context - queue for uploading
			this.queueForUpload(textDocument.uri);
		}
	}

	/**
	 * Adds the current service settings based on the contextual URI to the
	 * current configuration, then returns the configuration.
	 * @param {uri} uriContext
	 */
	addServiceSettings(uriContext) {
		const settings = this.settings.getServerJSON(
			uriContext,
			this.config.settingsFilename
		);

		// Make a duplicate to avoid changing the original config
		let newConfig = Object.assign({}, this.config);

		if (settings) {
			// Settings retrieved from JSON file within context
			newConfig.serviceName = settings.data.service;
			newConfig.serviceFilename = settings.file,
			newConfig.service = settings.data[newConfig.serviceName];
			newConfig.serviceSettingsHash = settings.hash;

			return newConfig;
		} else {
			// No settings for this context - show an error
			utils.showError(
				`A settings file could not be found within your project. Have you ` +
				`created a file with the name "${this.config.settingsFilename}" yet?`
			);

			return false;
		}
	}

	getQueue(queueName) {
		if (!this.queues[queueName]) {
			this.queues[queueName] = new Queue();
		}

		return this.queues[queueName];
	}

	/**
	 * @param {array} tasks - Tasks to execute. Must contain the properties detailed below.
	 * @param {boolean} [runImmediately="false"] - Whether to run the tasks immediately.
	 * @description
	 * Routes to a service method after doing required up-front work.
	 *
	 * ### Task properties:
	 * - `method` (`string`): Method to run.
	 * - `uriContext` (`uri`): URI context for the method.
	 * - `args` (`array`): Array of arguments to send to the method.
	 */
	route(tasks = [], runImmediately = false, queueName = Push.queueNames.default) {
		const queue = this.getQueue(queueName);

		tasks.forEach(({ method, uriContext, args }) => {
			// Add queue item with contextual config
			queue.addTask(() => {
				let config;

				if (uriContext) {
					// Add service settings to the current configuration
					config = this.addServiceSettings(uriContext);
				} else {
					throw new Error('No uriContext set from route source.');
				}

				if (config) {
					console.log(`Running queue entry ${method}...`);

					// Execute the service method, returning any results and/or promises
					return this.service.exec(method, config, args);
				}
			});
		});

		if (runImmediately) {
			return this.execQueue(queueName);
		}
	}

	queueForUpload(uri) {
		uri = this.paths.getFileSrc(uri);

		return this.route([{
			method: 'put',
			uriContext: uri,
			args: [this.paths.getNormalPath(uri)]
		}], false, Push.queueNames.upload);
	}

	execQueue(queueName) {
		return this.getQueue(queueName)
			.exec(this.service.getStateProgress)
			.then((report) => {
				if (report) {
					// TODO: handle a report
				}

				utils.showMessage('Queue complete.');
			})
			.catch(utils.showWarning);
	}

	execUploadQueue() {
		return this.execQueue(Push.queueNames.upload);
	}

	upload(uri) {
		return this.transfer('put', uri);
	}

	download(uri) {
		return this.transfer('get', uri);
	}

	transfer(method, uri) {
		uri = this.paths.getFileSrc(uri);

		if (this.paths.isDirectory(uri)) {
			return this.paths.getDirectoryContentsAsFiles(uri)
				.then((files) => {
					let tasks = files.map((uri) => {
						return {
							method,
							uriContext: uri,
							args: [this.paths.getNormalPath(uri)]
						};
					});

					this.route(tasks, true);
				});
		} else {
			return this.route([{
				method,
				uriContext: uri,
				args: [this.paths.getNormalPath(uri)]
			}], true);
		}
	}
}

Push.queueNames = {
	default: 'default',
	upload: 'upload'
};

module.exports = Push;