const vscode = require('vscode');

const ServiceSettings = require('./lib/ServiceSettings');
const Service = require('./lib/Service');
const PushBase = require('./lib/PushBase');
const Explorer = require('./lib/explorer/Explorer');
const Paths = require('./lib/Paths');
const Queue = require('./lib/Queue');
const Watch = require('./lib/Watch');
const channel = require('./lib/channel');
const i18n = require('./lang/i18n');

class Push extends PushBase {
	constructor() {
		super();

		this.didSaveTextDocument = this.didSaveTextDocument.bind(this);
		this.setContexts = this.setContexts.bind(this);
		this.refreshWatchList = this.refreshWatchList.bind(this);

		this.initService();

		this.paths = new Paths();
		this.explorer = new Explorer(this.config);

		this.watch = new Watch();
		this.watch.onWatchUpdate = this.refreshWatchList;

		this.queues = {};

		// Set initial contexts
		this.setContexts(true);

		// Create event handlers
		vscode.workspace.onDidSaveTextDocument(this.didSaveTextDocument);
		// vscode.workspace.onDidChangeConfiguration(this.setContexts);
	}

	/**
	 * Localised setConfig, also sets context and explorer config
	 */
	setConfig() {
		super.setConfig();
		console.log('local setconfig');

		if (this.setContexts) {
			this.setContexts();
		}

		if (this.explorer) {
			this.explorer.setConfig(this.config);
		}
	}

	/**
	 * Set (or re-set) contexts
	 */
	setContexts(initial) {
		this.setContext(Push.contexts.uploadQueue, this.config.uploadQueue);
		this.setContext(Push.contexts.initialised, true);

		if (initial === true) {
			this.setContext(Push.contexts.queueInProgress, false);
		}
	}

	initService() {
		this.settings = new ServiceSettings();
		this.service = new Service({
			onDisconnect: (hadError) => {
				this.stopCancellableQueues(!!hadError, !!hadError);
			}
		});
	}

	execUploadQueue() {
		if (!this.config.uploadQueue) {
			return channel.appendLocalisedInfo('upload_queue_disabled');
		}

		return this.execQueue(Push.queueDefs.upload);
	}

	listQueueItems(queueDef) {
		if (this.queues[queueDef.id]) {
			channel.appendLocalisedInfo();

			this.queues[queueDef.id].getTasks().forEach((item) => {
				if (item.actionTaken) {
					channel.appendLine(item.actionTaken);
				}
			});
		} else {
			channel.appendLocalisedInfo('no_current_upload_queue');
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

		if (this.config.uploadQueue && settings) {
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
				channel.appendLocalisedError('service_not_defined', this.config.settingsFilename);
				return false;
			}

			newConfig.serviceName = settings.data.service;
			newConfig.serviceFilename = settings.file,
				newConfig.service = settings.data[newConfig.serviceName];
			newConfig.serviceSettingsHash = settings.hash;

			return newConfig;
		} else {
			// No settings for this context - show an error
			channel.appendLocalisedError('no_service_file', this.config.settingsFilename);
			return false;
		}
	}

	/**
	 * @param {array} tasks - Tasks to execute. Must contain the properties detailed below.
	 * @param {boolean} [runImmediately="false"] - Whether to run the tasks immediately (if the queue isn't already
	 * running).
	 * @param {object} [queueDef=Push.queueDefs.default] - Which queue to use.
	 * @param {boolean} [showStatus=false] - Show the length of the queue in the status bar.
	 * @description
	 * Queues a task for a service method after doing required up-front work.
	 *
	 * ### Task properties:
	 * - `method` (`string`): Method to run.
	 * - `uriContext` (`uri`): URI context for the method.
	 * - `args` (`array`): Array of arguments to send to the method.
	 */
	queue(
		tasks = [],
		runImmediately = false,
		queueDef = Push.queueDefs.default,
		queueOptions
	) {
		const queue = this.getQueue(queueDef, queueOptions);

		if (!queue) {
			throw new Error('No valid queue defined in Push#queue');
		}

		// Add initial init to a new queue
		if (queue.tasks.length === 0 && !queue.running) {
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
					// Execute the service method, returning any results and/or promises
					return this.service.exec(method, config, args);
				}
			}, {
				id,
				actionTaken,
				uriContext
			});
		});

		if (runImmediately && !queue.running) {
			return this.execQueue(queueDef);
		}

		this.refreshQueues({
			queues: this.queues
		});
	}

	/**
	 * Queues a single file to be uploaded within the deferred queue. Will honour ignore list.
	 * @param {uri} uri - File Uri to queue
	 */
	queueForUpload(uri) {
		let remotePath;

		uri = this.paths.getFileSrc(uri);

		if (this.service) {
			remotePath = this.service.exec(
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
						args: [uri, remotePath],
						id: remotePath + this.paths.getNormalPath(uri)
					}], false, Push.queueDefs.upload, {
						showStatus: true,
						statusToolTip: (num) => {
							return i18n.t('num_to_upload', num);
						},
						statusCommand: 'push.uploadQueuedItems',
						emptyOnFail: false
					});
				});
		}
	}

	/**
	 * Retrieve a queue instance by its definition.
	 * @param {object} queueDef - One of the {@link Push.queueDefs} keys.
	 * @param {object|boolean} [queueOptions] - Either set the queue options, or
	 * set to `false` to ensure a queue is not created if it doesn't already
	 * exit
	 * @returns {object} A single instance of Queue.
	 */
	getQueue(queueDef, queueOptions) {
		if (typeof queueDef !== 'object' || !queueDef.id) {
			throw new Error('Invalid queue definition type.');
		}

		if (!this.queues[queueDef.id]) {
			if (queueOptions === false) {
				// No new queue wanted, just return null;
				return null;
			}

			this.queues[queueDef.id] = new Queue(queueDef.id, queueOptions);
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

		// Fetch and execute queue
		return this.getQueue(queueDef)
			.exec(this.service.getStateProgress)
			.then(() => {
				// Set contextual state that the queue has completed
				this.setContext(Push.contexts.queueInProgress, false);
				this.refreshQueues();
			})
			.catch((error) => {
				// Set contextual state that the queue has completed
				this.setContext(Push.contexts.queueInProgress, false);
				this.refreshQueues();
				throw error;
			});
	}

	refreshQueues() {
		this.explorer.refresh({
			queues: this.queues
		});
	}

	refreshWatchList(watchList) {
		this.explorer.refresh({
			watchList: watchList
		});
	}

	setContext(context, value) {
		vscode.commands.executeCommand('setContext', `push:${context}`, value);
		return this;
	}

	/**
	 * Stop any current queue operations.
	 */
	stopCancellableQueues(force = false, silent = false) {
		let def, queue;

		for (def in Push.queueDefs) {
			if (
				(queue = this.getQueue(Push.queueDefs[def])) &&
				Push.queueDefs[def].cancellable &&
				queue.running
			) {
				this.stopQueue(Push.queueDefs[def], force, silent);
			}
		}
	}

	/**
	 * Stops a queue.
	 * @param {object} queueDef - Queue definition
	 * @param {boolean} force - Set `true` to force a service disconnect as well
	 * as stopping the queue.
	 * @param {boolean} silent - Set `true` to stop a channel notice when
	 * stopping the queue.
	 */
	stopQueue(queueDef, force = false, silent = false) {
		// Get the queue by definition and run its #stop method.
		return vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			title: 'Push'
		}, (progress) => {
			return new Promise((resolve, reject) => {
				let timer;

				progress.report({ message: i18n.t('stopping') });

				if (force) {
					// Give X seconds to stop or force
					timer = setTimeout(() => {
						let message = i18n.t(
							'queue_force_stopped',
							queueDef.id,
							Push.globals.FORCE_STOP_TIMEOUT
						);

						this.service.restartServiceInstance();

						!silent && channel.appendError(message);
						reject(message);
					}, ((Push.globals.FORCE_STOP_TIMEOUT * 1000)));
				}

				this.getQueue(queueDef)
					.stop()
					.then((result) => {
						resolve(result);
						!silent && channel.appendLocalisedInfo(
							'queue_cancelled',
							queueDef.id
						);
					})
					.catch((error) => {
						reject(error);
					});

				if (force) {
					// Ensure the service stops in addition to the queue emptying
					this.service.stop()
						.then(() => {
							clearTimeout(timer);
						}, () => {
							clearTimeout(timer);
						});
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
				let config, remotePath;

				if (filteredUri !== false) {
					config = this.configWithServiceSettings(filteredUri);

					remotePath = this.service.exec(
						'convertUriToRemote',
						config,
						[filteredUri]
					);

					if (config) {
						// Add to queue and return
						return this.queue([{
							method,
							actionTaken,
							uriContext: filteredUri,
							args: [
								filteredUri,
								remotePath
							],
							id: remotePath + this.paths.getNormalPath(filteredUri)
						}], true);
					}
				} else {
					// Only one file is being transfered so warn the user it ain't happening
					channel.appendLocalisedError(
						'cannot_action_ignored_file',
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
						let remotePath;

						uri = vscode.Uri.file(uri);
						remotePath = this.service.exec(
							'convertUriToRemote',
							config,
							[uri]
						);

						return {
							method,
							actionTaken,
							uriContext: uri,
							args: [
								uri,
								remotePath
							],
							id: remotePath + this.paths.getNormalPath(uri)
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
						let uri;

						file = file.pathName || file;
						uri = this.service.exec(
							'convertRemoteToUri',
							config,
							[file]
						);

						return {
							method,
							actionTaken,
							uriContext: uri,
							args: [
								uri,
								file
							],
							id: file + this.paths.getNormalPath(uri)
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
						// More than one settings file found within the current directory
						channel.appendLocalisedError('multiple_service_files_no_transfer');

						reject();
					} else {
						// 1 or less file found
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

Push.globals = {
	FORCE_STOP_TIMEOUT: 5 // In seconds
};

Push.contexts = {
	uploadQueue: 'uploadQueue',
	initialised: 'initialised',
	queueInProgress: 'queueInProgress'
};

module.exports = Push;
