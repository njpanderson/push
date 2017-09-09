const vscode = require('vscode');
const path = require('path');

// const Push = require('./Push');
const ServiceSettings = require('./lib/ServiceSettings');
const Service = require('./lib/Service');
const Paths = require('./lib/Paths');

/**
 * Provides a normalised interface for the command panel and contextual menus.
 */
class PushCommand {
	constructor() {
		this.upload = this.upload.bind(this);
		this.download = this.download.bind(this);
		this.checkServiceSettingsChange = this.checkServiceSettingsChange.bind(this);

		this.settings = new ServiceSettings();
		this.service = new Service();
		this.paths = new Paths();

		this.uriContext = '';
		this.config = null;

		this.queue = {
			command: []
		};

		// Set initial config
		this.setConfig();

		// Create event handlers
		vscode.workspace.onDidChangeConfiguration(this.setConfig);
		vscode.workspace.onDidSaveTextDocument(this.checkServiceSettingsChange);
	}

	setUriContext(uri) {
		return (this.uriContext = this.paths.getFileSrc(uri));
	}

	setConfig() {
		this.config = Object.assign({}, vscode.workspace.getConfiguration(
			'njpPush',
			vscode.window.activeTextEditor.document.uri
		));
	}

	/**
	 * Check that a textDocument change event is for a valid service settings file
	 * @param {textDocument} textDocument
	 */
	checkServiceSettingsChange(textDocument) {
		if (path.basename(textDocument.uri.path) === this.config.settingsFilename) {
			// File being changed is a server config file - regenerate server settings
			this.setServiceSettings(textDocument.uri);
		}
	}

	/**
	 * Set the current service settings based on the contextual URI.
	 * @param {uri} uriContext
	 */
	setServiceSettings(uriContext) {
		const settings = this.settings.getServerJSON(
				uriContext,
				this.config.settingsFilename
		);

		if (settings) {
			this.config.serviceName = settings.data.service;
			this.config.service = settings.data[this.config.serviceName];

			if (settings.newFile) {
				// Settings have changed.
				this.service.restartServiceInstance(this.config);
			}

			return settings;
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
	route(method, args, runImmediately = false, queueName = 'command') {
		// Queue the push method
		this.queue[queueName].push(() => {
			// Set the current URI context
			console.log(`Running queue entry ${method}...`);

			if (this.uriContext && this.setServiceSettings(this.uriContext)) {
				// Execute the service method, returning any results and/or promises
				let result = this.service.exec(method, this.config, args);
				console.log(result);
				return result;
			} else {
				throw new Error('No uriContext set from route source');
			}
		});

		if (runImmediately) {
			return this.execQueue(queueName);
		}
	}

	/**
	 * Invokes all stored functions within the queue, returning a promise
	 * @param {string} queueName='command' - Name of the queue to run
	 */
	execQueue(queueName = 'command') {
		let progressInterval;

		if (this.queue[queueName]) {
			console.log(`Running ${this.queue[queueName].length} task(s) in queue...`);

			vscode.window.withProgress({
				location: vscode.ProgressLocation.Window,
				title: 'Push'
			}, (progress) => {
				return new Promise((resolve) => {
					console.log('Progress queue');
					let result = [];
					progress.report({ message: 'Processing' });

					progressInterval = setInterval(() => {
						if (this.service.progress !== null) {
							progress.report({ message: 'Processing ' + this.service.progress });
						} else {
							progress.report({ message: 'Processing' });
						}
					}, 10);

					this.queue[queueName].forEach((item) => {
						result.push(item());
					});

					return Promise.all(result)
						.then(() => {
							console.log('Queue complete', arguments);
							clearInterval(progressInterval);
							this.queue[queueName] = [];
							resolve();
						})
						.catch((error) => {
							throw error;
						});
				});
			});
		} else {
			return Promise.reject(`Queue name ${queueName} not found.`);
		}
	}

	upload(src) {
		this.setUriContext(src);
		return this.route('put', [this.uriContext.path], true);
	}

	download(src) {
		this.setUriContext(src);
		return this.route('get', [this.uriContext.path], true);
	}
}

module.exports = PushCommand;