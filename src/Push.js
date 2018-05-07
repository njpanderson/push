const vscode = require('vscode');

const ServiceSettings = require('./lib/ServiceSettings');
const Service = require('./lib/Service');
const PushBase = require('./lib/PushBase');
const Explorer = require('./lib/explorer/Explorer');
const Paths = require('./lib/Paths');
const Queue = require('./lib/queue/Queue');
const QueueTask = require('./lib/queue/QueueTask');
const Watch = require('./lib/Watch');
const SCM = require('./lib/SCM');
const channel = require('./lib/channel');
const utils = require('./lib/utils');
const i18n = require('./lang/i18n');

class Push extends PushBase {
	constructor() {
		super();

		this.didSaveTextDocument = this.didSaveTextDocument.bind(this);
		this.setContexts = this.setContexts.bind(this);
		this.setEditorState = this.setEditorState.bind(this);
		this.refreshExplorerWatchList = this.refreshExplorerWatchList.bind(this);

		this.initService();

		this.paths = new Paths();
		this.explorer = new Explorer(this.config);
		this.scm = new SCM();

		this.watch = new Watch();
		this.watch.onWatchUpdate = this.refreshExplorerWatchList;

		this.queues = {};

		// Set initial contexts
		this.setContexts(true);
		this.setEditorState(vscode.window.activeTextEditor);

		// Create event handlers
		vscode.workspace.onDidSaveTextDocument(this.didSaveTextDocument);
		vscode.workspace.onDidChangeConfiguration(this.setContexts);
		vscode.window.onDidChangeActiveTextEditor(this.setEditorState);
	}

	/**
	 * Localised setConfig, also sets context and explorer config
	 */
	setConfig() {
		super.setConfig();

		if (this.setContexts) {
			this.setContexts();
		}

		if (this.explorer) {
			this.explorer.setConfig(this.config);
			this.explorer.refresh();
		}
	}

	/**
	 * Set (or re-set) contexts
	 */
	setContexts(initial) {
		this.setContext(Push.contexts.hasUploadQueue, this.config.uploadQueue);

		if (initial === true) {
			this.setContext(Push.contexts.initialised, true);
		}
	}

	/**
	 * Initialises the service class.
	 */
	initService() {
		this.settings = new ServiceSettings();
		this.service = new Service({
			onDisconnect: (hadError) => {
				this.stopCancellableQueues(!!hadError, !!hadError);
			}
		});
	}

	/**
	 * Adds the files in the current Git working copy to the upload queue.
	 * @param {Uri} uri - Contextual Uri.
	 * @param {boolean} [exec=`false`] - `true` to immediately upload, `false` to queue.
	 */
	queueGitChangedFiles(uri, exec = false) {
		this.scm.exec(
			SCM.providers.git,
			this.paths.getCurrentWorkspaceRootPath(
				uri,
				true
			),
			'listWorkingUris'
		).then((files) => {
			if (exec) {
				// Immediately execute uploads
				this.transfer(files, 'put');
			} else {
				// Queue uploads
				this.queueForUpload(files);
			}
		});
	}

	/**
	 * Handle text document save events
	 * @param {textDocument} textDocument
	 */
	didSaveTextDocument(textDocument) {
		let settings;

		if (!textDocument.uri || this.paths.isValidScheme(textDocument.uri)) {
			return;
		}

		this.settings.clear();

		settings = this.settings.getServerJSON(
			textDocument.uri,
			this.config.settingsFilename,
			true
		);

		if (this.config.uploadQueue && settings) {
			// File being changed is a within a service context - queue for uploading
			this.queueForUpload(textDocument.uri)
				.then(() => this.setEditorState());
		}
	}

	setEditorState(textEditor) {
		let uploadQueue = this.getQueue(Push.queueDefs.upload, false);

		if (!textEditor) {
			// Ensure textEditor defaults
			textEditor = vscode.window.activeTextEditor;
		}

		if (!textEditor || !textEditor.document) {
			// Bail if there's still no editor, or no document
			return;
		}

		if (
			uploadQueue &&
			(uploadQueue.tasks.length > 0 && uploadQueue.tasks.length < 100)
		) {
			// Make sure tasks exist and hard limit of 100
			this.setContext(
				Push.contexts.activeEditorInUploadQueue,
				uploadQueue.hasTaskByUri(textEditor.document.uri)
			);
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
	 * Each task item may contain the following properties:
	 * - `method` (`string`): Method name to invoke on the service instance.
	 * - `actionTaken` (`string`): String defining the past tense of the action taken for reporting.
	 * - `uriContext` (`uri`): URI context for the method, if applicable.
	 * - `args` (`array`): Array of arguments to send to the method being invoked.
	 * - `id` (`string`): A unique identifier for the task. Used for duplicate detection.
	 * - `onTaskComplete` (`function`): A function to invoke on individual task completion.
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
			queue.addTask(new QueueTask(() => {
				return this.service.activeService &&
					this.service.activeService.init(queue.tasks.length);
			}));
		}

		tasks.forEach((task) => {
			if (task instanceof QueueTask) {
				// Add the task as-is
				return queue.addTask(task);
			}

			// Add queue item with contextual config
			queue.addTask(
				new QueueTask(
					(() => {
						let config;

						if (task.uriContext) {
							// Add service settings to the current configuration
							config = this.configWithServiceSettings(task.uriContext);
						} else {
							throw new Error('No uriContext set from queue source.');
						}

						if (config) {
							// Execute the service method, returning any results and/or promises
							return this.service.exec(task.method, config, task.args)
								.then((result) => {
									if (typeof task.onTaskComplete === 'function') {
										task.onTaskComplete.call(this, result);
									}
								});
						}
					}),
					task.id,
					{
						actionTaken: task.actionTaken,
						uriContext: task.uriContext
					}
				)
			);
		});

		this.refreshExplorerQueues();

		if (runImmediately) {
			return this.execQueue(queueDef);
		}
	}

	/**
	 * @description
	 * Queues a single file or array of files to be uploaded within the deferred queue.
	 * Will honour the active ignore list.
	 * @param {Uri[]} uris - Uri or array of Uris of file(s) to queue.
	 */
	queueForUpload(uris) {
		if (!Array.isArray(uris)) {
			uris = [uris];
		}

		uris.forEach((uri) => {
			let remotePath;

			uri = this.paths.getFileSrc(uri);

			if (this.service) {
				remotePath = this.service.exec(
					'convertUriToRemote',
					this.configWithServiceSettings(uri),
					[uri]
				);

				this.paths.filterUriByGlobs(uri, this.config.ignoreGlobs)
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
		});
	}

	/**
	 * @description
	 * Copies the "upload" queue over to the default queue and runs the default queue.
	 * The upload queue is then emptied once the default queue has completed without
	 * errors.
	 */
	execUploadQueue() {
		let uploadQueue, queue;

		if (!this.config.uploadQueue) {
			return channel.appendLocalisedInfo('upload_queue_disabled');
		}

		uploadQueue = this.getQueue(Push.queueDefs.upload);

		if (uploadQueue.tasks.length) {
			queue = this.queue(uploadQueue.tasks, true)

			if (queue instanceof Promise) {
				queue.then(() => {
					uploadQueue.empty();
				});
			}
		} else {
			utils.showWarning(i18n.t('queue_empty'));
		}

		return uploadQueue
	}

	/**
	 * Compares a local file with the remote equivalent using the service mapping rules.
	 * @param {Uri} uri - Uri of the local file to compare.
	 */
	diffRemote(uri) {
		let config, tmpFile, remotePath;

		tmpFile = utils.getTmpFile();
		config = this.configWithServiceSettings(uri);
		remotePath = this.service.exec(
			'convertUriToRemote',
			config,
			[uri]
		);

		// Use the queue to get a file then diff it
		return this.queue([{
			method: 'get',
			actionTaken: 'downloaded',
			uriContext: uri,
			args: [
				tmpFile,
				remotePath,
				'overwrite'
			],
			id: tmpFile + remotePath,
			onTaskComplete: () => {
				vscode.commands.executeCommand(
					'vscode.diff',
					tmpFile,
					uri,
					'Diff: ' + this.paths.getBaseName(uri)
				);
			}
		}], true, Push.queueDefs.diff);
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
	 * Execute a queue (by running its #exec method).
	 * @param {object} queueDef - One of the {@link Push.queueDefs} queue definitions.
	 * @returns {promise} A promise, eventually resolving once the queue is complete.
	 */
	execQueue(queueDef) {
		const queue = this.getQueue(queueDef);

		if (!(queue instanceof Queue)) {
			throw new Error('Invalid queue definition type.');
		}

		if (queue.running) {
			return null;
		}

		// channel.clear();

		// Fetch and execute queue
		return queue
			.exec(this.service.getStateProgress)
			.then(() => {
				this.refreshExplorerQueues();
			})
			.catch((error) => {
				this.refreshExplorerQueues();
				throw error;
			});
	}

	/**
	 * Lists all current queue items.
	 * @param {object} queueDef - One of the Push.queueDefs items.
	 */
	listQueueItems(queueDef) {
		let queue = this.getQueue(queueDef, false);

		if (queue) {
			channel.appendLocalisedInfo();

			queue.tasks.forEach((item) => {
				if (item.actionTaken) {
					channel.appendLine(item.actionTaken);
				}
			});
		} else {
			channel.appendLocalisedInfo('no_current_upload_queue');
		}
	}

	/**
	 * Removes a single item from a queue by its Uri.
	 * @param {object} queueDef - One of the Push.queueDefs items.
	 * @param {*} uri - Uri of the item to remove.
	 */
	removeQueuedItem(queueDef, uri) {
		let queue = this.getQueue(queueDef, false);

		if (queue) {
			queue.removeTaskByUri(uri);
			this.refreshExplorerQueues();
		}
	}

	clearQueue(queueDef) {
		let queue = this.getQueue(queueDef, false);

		if (queue && queue.empty()) {
			this.refreshExplorerQueues();
			return true;
		}

		return false;
	}

	/**
	 * Refresh the Push explorer queue data.
	 */
	refreshExplorerQueues() {
		this.explorer.refresh({
			queues: this.queues
		});
	}

	/**
	 * Refresh the Push explorer watch list data.
	 */
	refreshExplorerWatchList(watchList) {
		this.explorer.refresh({
			watchList: watchList
		});
	}

	/**
	 * Sets the VS Code context for general Push states
	 * @param {string} context - Context item name
	 * @param {mixed} value - Context value
	 */
	setContext(context, value) {
		// console.log(`Setting push context: push:${context} to "${value}"`);
		vscode.commands.executeCommand('setContext', `push:${context}`, value);
		return this;
	}

	/**
	 * Stop any current queue operations.
	 * @param {boolean} force - Set `true` to force any current operations to stop.
	 * @param {boolean} silent - Set `true` to create no notices when stopping the queue.
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
						// Force stop the queue
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
							resolve();
						}, () => {
							clearTimeout(timer);
							reject();
						});
				}
			});
		});
	}

	/**
	 * Transfers a single file or array of single files.
	 * @param {Uri[]} uris - Uri or array of Uris of file(s) to transfer.
	 * @param {string} method - Either 'get' or 'put'.
	 * @returns {promise} - A promise, resolving when the file has transferred.
	 */
	transfer(uris, method) {
		let ignoreGlobs = [], action, actionTaken;

		this.settings.clear();

		if (!Array.isArray(uris)) {
			uris = [uris];
		}

		if (method === 'put') {
			action = 'upload';
			actionTaken = 'uploaded';

			// Filter Uri by the ignore globs when uploading
			ignoreGlobs = this.config.ignoreGlobs;
		} else if (method === 'get') {
			action = 'download';
			actionTaken = 'downloaded';
		} else {
			throw new Error(`Unkown method "${method}"`);
		}

		uris.forEach((uri, index) => {
			// Check the source file is a usable scheme
			if (!this.paths.isValidScheme(uri)) {
				return;
			}

			// Check the source file isn't a directory
			if (this.paths.isDirectory(uri)) {
				throw new Error('Path is a directory and cannot be transferred with Push#transfer.');
			}

			// Check that the source file exists
			if (method === 'put' && !this.paths.fileExists(uri)) {
				channel.appendLocalisedError(
					'file_not_found',
					this.paths.getNormalPath(uri)
				);

				return;
			}

			// Filter and add to the queue
			this.paths.filterUriByGlobs(uri, ignoreGlobs)
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
							// Add to queue and return (also start on the last item added)
							return this.queue([{
								method,
								actionTaken,
								uriContext: filteredUri,
								args: [
									filteredUri,
									remotePath
								],
								id: remotePath + this.paths.getNormalPath(filteredUri)
							}], (index === uris.length - 1));
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
		});
	}

	/**
	 * Transfers a directory of files.
	 * @param {Uri} uri - Uri of the directory to transfer.
	 * @param {*} method - Either 'get' or 'put'.
	 * @returns {promise} - A promise, resolving when the directory has transferred.
	 */
	transferDirectory(uri, method) {
		let ignoreGlobs = [], actionTaken, config, remoteUri;

		// Check the source directory is a usable scheme
		if (!this.paths.isValidScheme(uri)) {
			return;
		}

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

	/**
	 * Ensures that a Uri path only contains one service settings file (e.g. .push.settings.json).
	 * @param {Uri} uri - Uri to test.
	 */
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

	/**
	 * @description
	 * Checks if a Uri passed is usable by Push and returns it. If no Uri is passed,
	 * Push will attempt to detect one from the current context.
	 * Will produce an error message if the Uri is not valid.
	 * @param {Uri} uri - Uri to test.
	 */
	getValidUri(uri) {
		uri = this.paths.getFileSrc(uri);

		if (this.paths.isValidScheme(uri)) {
			return uri;
		}

		utils.showError(i18n.t('invalid_uri_scheme', uri.scheme));
		return false;
	}
}

Push.queueDefs = {
	default: {
		id: 'default',
		cancellable: true
	},
	diff: {
		id: 'diff',
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
	hasUploadQueue: 'hasUploadQueue',
	initialised: 'initialised',
	activeEditorInUploadQueue: 'activeEditorInUploadQueue'
};

module.exports = Push;
