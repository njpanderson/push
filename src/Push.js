const vscode = require('vscode');
const path = require('path');

const ServiceSettings = require('./lib/ServiceSettings');
const Service = require('./lib/Service');
const Paths = require('./lib/Paths');

/**
 * Provides a normalised interface for the command panel and contextual menus.
 */
class Push {
	constructor() {
		this.upload = this.upload.bind(this);
		this.download = this.download.bind(this);
		this.setConfig = this.setConfig.bind(this);
		this.uploadQueue = this.uploadQueue.bind(this);
		this.didSaveTextDocument = this.didSaveTextDocument.bind(this);
		// this.checkServiceSettingsChange = this.checkServiceSettingsChange.bind(this);

		this.settings = new ServiceSettings();
		this.service = new Service();
		this.paths = new Paths();

		this.config = null;

		this.queue = {
			default: []
		};

		// Set initial config
		this.setConfig();

		// Create event handlers
		vscode.workspace.onDidChangeConfiguration(this.setConfig);
		vscode.workspace.onDidSaveTextDocument(this.didSaveTextDocument);
	}

	setConfig() {
		this.config = Object.assign({}, vscode.workspace.getConfiguration(
			'njpPush',
			vscode.window.activeTextEditor.document.uri
		));
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
			vscode.window.showErrorMessage(
				`A settings file could not be found within your project. Have you ` +
				`created a file with the name "${this.config.settingsFilename}" yet?`
			);

			return false;
		}
	}

	/**
	 * Routes to a service method after doing required up-front work.
	 * @param {string} method - Method name to execute
	 */
	route(method, uriContext, args, runImmediately = false, queueName = Push.queueNames.default) {
		// Cheque named queue exists
		if (!this.queue[queueName]) {
			this.queue[queueName] = [];
		}

		// Add queue item with contextual config
		this.queue[queueName].push(() => {
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

		if (runImmediately) {
			return this.execQueue(queueName);
		}
	}

	/**
	 * Invokes all stored functions within the queue, returning a promise
	 * @param {string} queueName='default' - Name of the queue to run
	 */
	execQueue(queueName = Push.queueNames.default) {
		let progressInterval;

		if (this.queue[queueName]) {
			console.group(`Running ${this.queue[queueName].length} task(s) in queue...`);

			vscode.window.withProgress({
				location: vscode.ProgressLocation.Window,
				title: 'Push'
			}, (progress) => {
				return new Promise((resolve) => {
					progress.report({ message: 'Processing' });

					progressInterval = setInterval(() => {
						let state;

						if ((state = this.service.getStateProgress())) {
							progress.report({ message: `Processing ${state}` });
						} else {
							progress.report({ message: 'Processing' });
						}
					}, 10);

					this.execQueueItems(
						this.queue[queueName],
						(results) => {
							console.log('Queue complete');
							console.groupEnd();
							clearInterval(progressInterval);
							this.queue[queueName] = [];
							resolve();
						}
					);
				});
			});
		} else {
			return Promise.reject(`Queue name ${queueName} not found.`);
		}
	}

	/**
	 * Executes all items within a queue in serial and invokes the callback on completion.
	 * @param {array} queue
	 * @param {function} callback
	 * @param {array} results
	 * @param {number} [index]
	 */
	execQueueItems(queue, callback, results = [], index = 0) {
		if (index < queue.length) {
			console.log(`Invoking queue item ${index}...`);
			queue[index]()
				.then((result) => {
					results.push(result);
					this.execQueueItems(queue, callback, results, index + 1);
				})
				.catch((error) => {
					throw error;
				});
		} else {
			callback(results);
		}
	}

	/**
	 * Sorts a queue by the settings hash.
	 * @param {string} queueName
	 */
	sortQueue(queueName) {
		// TODO:
	}

	queueForUpload(uri) {
		uri = this.paths.getFileSrc(uri);
		return this.route('put', uri, [uri.path], false, Push.queueNames.saved);
	}

	upload(uri) {
		uri = this.paths.getFileSrc(uri);
		return this.route('put', uri, [uri.path], true);
	}

	uploadQueue() {
		if (this.queue[Push.queueNames.saved] && this.queue[Push.queueNames.saved].length) {
			return this.execQueue(Push.queueNames.saved);
		} else {
			vscode.window.showWarningMessage(
				`The upload queue is currently empty. No items were uploaded.`
			);
		}
	}

	download(uri) {
		uri = this.paths.getFileSrc(uri);
		return this.route('get', uri, [uri.path], true);
	}
}

Push.queueNames = {
	default: 'default',
	saved: 'saved'
};

module.exports = Push;