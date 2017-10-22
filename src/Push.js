const vscode = require('vscode');

const ServiceSettings = require('./lib/ServiceSettings');
const Service = require('./lib/Service');
const Paths = require('./lib/Paths');
const Queue = require('./lib/Queue');
const utils = require('./lib/utils');
const channel = require('./lib/channel');

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
		this.cancelQueues = this.cancelQueues.bind(this);
		this.stopQueues = this.stopQueues.bind(this);

		this.settings = new ServiceSettings();
		this.service = new Service({
			onDisconnect: () => {
				this.stopCancellableQueues();
			}
		});
		this.paths = new Paths();

		this.config = null;

		this.queues = {};

		// Set initial config
		this.setConfig();

		// Create event handlers
		vscode.workspace.onDidChangeConfiguration(this.setConfig);
		vscode.workspace.onDidSaveTextDocument(this.didSaveTextDocument);

		// Set initial contexts
		this.setContext(Push.contexts.queueInProgress, false);
	}

	execUploadQueue() {
		return this.execQueue(Push.queueDefs.upload);
	}

	clearUploadQueue() {
		// TODO: Write
	}

	/**
	 * Uploads a single file or directory by its Uri.
	 * @param {Uri} uri
	 */
	upload(uri) {
		uri = this.paths.getFileSrc(uri);

		if (this.paths.isDirectory(uri)) {
			return this.ensureSingleService(uri)
				.then(() => {
					return this.transferDirectory(uri, 'put');
				});
		}

		return this.transfer(uri, 'put');
	}

	/**
	 * Downloads a single file or directory by its Uri.
	 * @param {Uri} uri
	 */
	download(uri) {
		uri = this.paths.getFileSrc(uri);

		if (this.paths.isDirectory(uri)) {
			return this.ensureSingleService(uri)
				.then(() => {
					return this.transferDirectory(uri, 'get');
				});
		}

		return this.transfer(uri, 'get');
	}

	cancelQueues() {
		this.stopCancellableQueues();
	}

	stopQueues() {
		this.stopCancellableQueues(true);
	}

	/**
	 * Sets the current configuration for the active workspace.
	 */
	setConfig() {
		let settingsGlob;

		this.config = Object.assign({}, vscode.workspace.getConfiguration(
			'njpPush',
			vscode.window.activeTextEditor &&
				vscode.window.activeTextEditor.document.uri
			));

		// Augment configuration with computed settings
		if (Array.isArray(this.config.ignoreGlobs)) {
			settingsGlob = `**/${this.config.settingsFilename}`;
			this.config.ignoreGlobs.push(settingsGlob);

			// Ensure glob list only contains unique values
			this.config.ignoreGlobs = utils.uniqArray(this.config.ignoreGlobs);
		}
	}

	/**
	 * Handle text document save events
	 * @param {textDocument} textDocument
	 */
	didSaveTextDocument(textDocument) {
		let settings;

		this.settings.clear();

		settings = this.settings.getServerJSON(
			textDocument.uri,
			this.config.settingsFilename,
			true
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
	configWithServiceSettings(uriContext) {
		const settings = this.settings.getServerJSON(
			uriContext,
			this.config.settingsFilename
		);

		// Make a duplicate to avoid changing the original config
		let newConfig = Object.assign({}, this.config);

		if (settings) {
			// Settings retrieved from JSON file within context
			if (!settings.data.service) {
				// Show a service error
				channel.appendError(utils.strings.SERVICE_NOT_DEFINED, this.config.settingsFilename);
				return false;
			}

			newConfig.serviceName = settings.data.service;
			newConfig.serviceFilename = settings.file,
			newConfig.service = settings.data[newConfig.serviceName];
			newConfig.serviceSettingsHash = settings.hash;

			return newConfig;
		} else {
			// No settings for this context - show an error
			channel.appendError(utils.strings.NO_SERVICE_FILE, this.config.settingsFilename);
			return false;
		}
	}

	/**
	 * @param {array} tasks - Tasks to execute. Must contain the properties detailed below.
	 * @param {boolean} [runImmediately="false"] - Whether to run the tasks immediately.
	 * @description
	 * Queues a task for a service method after doing required up-front work.
	 *
	 * ### Task properties:
	 * - `method` (`string`): Method to run.
	 * - `uriContext` (`uri`): URI context for the method.
	 * - `args` (`array`): Array of arguments to send to the method.
	 */
	queue(tasks = [], runImmediately = false, queueDef = Push.queueDefs.default) {
		const queue = this.getQueue(queueDef);

		if (!queue) {
			throw new Error('No valid queue defined in Push#queue');
		}

		// Add initial init to a new queue
		if (queue.tasks.length === 0) {
			queue.addTask(() => {
				return this.service.activeService &&
					this.service.activeService.init(queue.tasks.length);
			});
		}

		tasks.forEach(({ method, actionTaken, uriContext, args, id }) => {
			// Add queue item with contextual config
			queue.addTask(() => {
				let config;

				if (uriContext) {
					// Add service settings to the current configuration
					config = this.configWithServiceSettings(uriContext);
				} else {
					throw new Error('No uriContext set from queue source.');
				}

				if (config) {
					console.log(`Running queue entry ${method}...`);

					// Execute the service method, returning any results and/or promises
					return this.service.exec(method, config, args);
				}
			}, actionTaken, id);
		});

		if (runImmediately) {
			return this.execQueue(queueDef);
		}
	}

	/**
	 * Queues a single file to be uploaded within the deferred queue. Will honour ignore list.
	 * @param {uri} uri - File Uri to queue
	 */
	queueForUpload(uri) {
		let remoteUri;

		uri = this.paths.getFileSrc(uri);

		if (this.service) {
			remoteUri = this.service.exec(
				'convertUriToRemote',
				this.configWithServiceSettings(uri),
				[uri]
			);

			return this.paths.filterUriByGlobs(uri, this.config.ignoreGlobs)
				.then((filteredUri) => {
					if (!filteredUri) {
						return;
					}

					this.queue([{
						method: 'put',
						actionTaken: 'uploaded',
						uriContext: uri,
						args: [uri, remoteUri],
						id: remoteUri + this.paths.getNormalPath(uri)
					}], false, Push.queueDefs.upload);
				});
		}
	}

	/**
	 * Retrieve a queue instance by its definition.
	 * @param {object} queueDef - One of the {@link Push.queueDefs} keys.
	 * @returns {object} A single instance of Queue.
	 */
	getQueue(queueDef) {
		if (typeof queueDef !== 'object' || !queueDef.id) {
			throw new Error('Invalid queue definition type.');
		}

		if (!this.queues[queueDef.id]) {
			this.queues[queueDef.id] = new Queue();
		}

		return this.queues[queueDef.id];
	}

	/**
	 * Execute a queue, invoking its individual tasks in serial.
	 * @param {object} queueDef - One of the {@link Push.queueDefs} keys.
	 * @returns {promise} A promise, eventually resolving once the queue is complete.
	 */
	execQueue(queueDef) {
		if (typeof queueDef !== 'object' || !queueDef.id) {
			throw new Error('Invalid queue definition type.');
		}

		channel.clear();
		this.setContext(Push.contexts.queueInProgress, true);

		return this.getQueue(queueDef)
			.exec(this.service.getStateProgress)
				.then(() => {
					this.setContext(Push.contexts.queueInProgress, false);
				})
				.catch((error) => {
					this.setContext(Push.contexts.queueInProgress, false);
					throw error;
				});
	}

	setContext(context, value) {
		vscode.commands.executeCommand('setContext', `push:${context}`, value);
	}

	/**
	 * Stop any current queue operations.
	 */
	stopCancellableQueues(force = false) {
		let def;

		for (def in Push.queueDefs) {
			if (Push.queueDefs[def].cancellable) {
				this.stopQueue(Push.queueDefs[def], force);
			}
		}
	}

	/**
	 * Stops a queue.
	 * @param {object} queueDef - Queue definition
	 * @param {boolean} force - `true` to force a service disconnect as well as stopping the queue
	 */
	stopQueue(queueDef, force = false) {
		// Get the queue by definition and run its #stop method.
		return vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			title: 'Push'
		}, (progress) => {
			return new Promise((resolve, reject) => {
				progress.report({ message: 'Stopping...' });

				this.getQueue(queueDef)
					.stop()
					.then((result) => {
						resolve();
					})
					.catch((error) => {
						reject(error);
					});

				if (force) {
					// Ensure the service stops in addition to the queue emptying
					this.service.stop();
				}
			});
		});
	}

	/**
	 * Transfers a single file.
	 * @param {uri} uri - Uri of file to transfer
	 * @param {string} method - Either 'get' or 'put;
	 */
	transfer(uri, method) {
		let ignoreGlobs = [], action, actionTaken;

		if (this.paths.isDirectory(uri)) {
			throw new Error('Path is a directory and cannot be transferred with Push#transfer.');
		}

		this.settings.clear();

		if (method === 'put') {
			action = 'upload';
			actionTaken = 'uploaded';
		} else {
			action = 'download';
			actionTaken = 'downloaded';
		}

		if (method === 'put') {
			// Filter Uri by the ignore globs when uploading
			ignoreGlobs = this.config.ignoreGlobs;
		}

		return this.paths.filterUriByGlobs(uri, ignoreGlobs)
			.then((filteredUri) => {
				let config;

				if (filteredUri !== false) {
					config = this.configWithServiceSettings(filteredUri);

					if (config) {
						// Add to queue and return
						return this.queue([{
							method,
							actionTaken,
							uriContext: filteredUri,
							args: [
								filteredUri,
								this.service.exec(
									'convertUriToRemote',
									config,
									[filteredUri]
								)
							]
						}], true);
					}
				} else {
					// Only one file is being transfered so warn the user it ain't happening
					channel.appendError(
						utils.strings.CANNOT_ACTION_IGNORED_FILE,
						action,
						this.paths.getBaseName(uri)
					);
				}
			});
	}

	transferDirectory(uri, method) {
		let ignoreGlobs = [], actionTaken, config, remoteUri;

		if (!this.paths.isDirectory(uri)) {
			throw new Error(
				'Path is a single file and cannot be transferred with Push#transferDirectory.'
			);
		}

		// Get Uri from file/selection, src from Uri
		uri = this.paths.getFileSrc(uri);

		if (method === 'put') {
			actionTaken = 'uploaded';
		} else {
			actionTaken = 'downloaded';
		}

		// Always filter multiple Uris by the ignore globs
		ignoreGlobs = this.config.ignoreGlobs;
		config = this.configWithServiceSettings(uri);

		remoteUri = this.service.exec(
			'convertUriToRemote',
			config,
			[uri]
		);

		if (method === 'put') {
			// Recursively list local files and transfer each one
			return this.paths.getDirectoryContentsAsFiles(uri, ignoreGlobs)
				.then((files) => {
					let tasks = files.map((uri) => {
						uri = vscode.Uri.parse(uri);

						return {
							method,
							actionTaken,
							uriContext: uri,
							args: [
								uri,
								this.service.exec(
									'convertUriToRemote',
									config,
									[uri]
								)
							]
						};
					});

					// Add to queue and return
					return this.queue(tasks, true);
				});
		} else {
			// Recursively list remote files and transfer each one
			return this.service.exec('listRecursiveFiles', config, [remoteUri, ignoreGlobs])
				.then((files) => {
					let tasks = files.map((file) => {
						let uri = this.service.exec(
							'convertRemoteToUri',
							config,
							[file.pathName || file]
						);

						return {
							method,
							actionTaken,
							uriContext: uri,
							args: [
								uri,
								file.pathName || file
							]
						};
					});

					return this.queue(tasks, true);
				});
		}
	}

	ensureSingleService(uri) {
		return new Promise((resolve, reject) => {
			this.paths.getDirectoryContentsAsFiles(
				`${this.paths.getNormalPath(uri)}/**/${this.config.settingsFilename}`
			)
				.then((files) => {
					if (files.length > 1) {

						channel.showError(
							utils.strings.MULTIPLE_SERVICE_FILES + ' ' +
							utils.strings.TRANSFER_NOT_POSSIBLE
						);

						reject();
					} else if (files.length === 0) {
						channel.showError(
							utils.strings.NO_SERVICE_FILE,
							this.config.settingsFilename
						);

						reject();
					} else {
						resolve();
					}
				});
		});
	}
}

Push.queueDefs = {
	default: {
		id: 'default',
		cancellable: true
	},
	upload: {
		id: 'upload',
		cancellable: false
	}
};

Push.contexts = {
	queueInProgress: 'queueInProgress'
};

module.exports = Push;