const vscode = require('vscode');
const semver = require('semver');

const packageJson = require('../package.json');
const Service = require('./lib/Service');
const PushError = require('./lib/PushError');
const PushBase = require('./lib/PushBase');
const ExplorerWatchList = require('./lib/explorer/WatchList');
const ExplorerUploadQueue = require('./lib/explorer/UploadQueue');
const Paths = require('./lib/Paths');
const Queue = require('./lib/queue/Queue');
const QueueTask = require('./lib/queue/QueueTask');
const Watch = require('./lib/Watch');
const SCM = require('./lib/SCM');
const channel = require('./lib/channel');
const utils = require('./lib/utils');
const i18n = require('./lang/i18n');
const {
	STATUS_PRIORITIES,
	QUEUE_LOG_TYPES,
	ENV_DEFAULT_STATUS_COLOR,
	DEBUG
} = require('./lib/constants');

/**
 * Provides the main controller for Push.
 */
class Push extends PushBase {
	constructor(context) {
		super();

		utils.trace('Push', 'Begin instantiation', true);

		this.context = context;
		this.allowExternalServiceFiles = false;

		this.didSaveTextDocument = this.didSaveTextDocument.bind(this);
		this.setContexts = this.setContexts.bind(this);
		this.didChangeActiveTextEditor = this.didChangeActiveTextEditor.bind(this);
		this.onWatchUpdate = this.onWatchUpdate.bind(this);
		this.onWatchChange = this.onWatchChange.bind(this);

		// Rate limit functions
		this.setEnvStatus = this.rateLimit(
			Push.globals.ENV_TIMER_ID,
			500,
			this.setEnvStatus,
			this
		);

		this.initService();

		this.paths = new Paths();
		this.explorers = {
			watchList: new ExplorerWatchList(this.config),
			uploadQueue: new ExplorerUploadQueue(this.config)
		};
		this.scm = new SCM();

		// Create watch class and set initial watchers
		this.watch = new Watch(this.context.globalState);
		this.watch.onWatchUpdate = this.onWatchUpdate;
		this.watch.onChange = this.onWatchChange;
		this.watch.recallByWorkspaceFolders(vscode.workspace.workspaceFolders);

		utils.trace('Push', 'Libraries initialised');

		this.queues = {};

		// Set initial contexts
		this.setContexts(true);

		this.event('onDidChangeActiveTextEditor', vscode.window.activeTextEditor);

		// Create event handlers
		vscode.workspace.onDidSaveTextDocument((textDocument) => {
			this.event('onDidSaveTextDocument', textDocument);
		});

		vscode.window.onDidChangeActiveTextEditor((textEditor) => {
			this.event('onDidChangeActiveTextEditor', textEditor);
		});

		utils.trace('Push', 'Events bound');

		if (!DEBUG) {
			// Once initialised, do the new version check
			this.checkNewVersion();
		}
	}

	/**
	 * @description
	 * Checks for a major/minor version, and if found, loads the changelog,
	 * based on the users preferences. Also sets the current version into storage.
	 */
	checkNewVersion() {
		const currentVersion = this.context.globalState.get(
			Push.globals.VERSION_STORE
		);

		if (typeof currentVersion === 'undefined') {
			// Let's do nothing for new installs
			return;
		}

		utils.trace(
			'Push',
			`Current version: ${currentVersion}, Package version: ${packageJson.version}`
		);

		if (
			['major', 'minor'].indexOf(
				semver.diff(currentVersion, packageJson.version)
			) !== -1
		) {
			// Major or minor version mismatch
			if (this.config.showChangelog) {
				// Load the changelog
				this.showChangelog();
			}

			// Display a small notice
			vscode.window.showInformationMessage(
				i18n.t('push_upgraded', packageJson.version),
				(!this.config.showChangelog ? {
					isCloseAffordance: true,
					id: 'show_changelog',
					title: i18n.t('show_changelog')
				} : null)
			).then((option) => {
				if (option && option.id === 'show_changelog') {
					this.showChangelog();
				}
			});
		}

		// Retain next version
		this.context.globalState.update(
			Push.globals.VERSION_STORE,
			packageJson.version
		);
	}

	/**
	 * Shows the Push changelog in a markdown preview.
	 */
	showChangelog() {
		vscode.commands.executeCommand(
			'markdown.showPreview',
			vscode.Uri.file(this.context.extensionPath + '/CHANGELOG.md')
		);
	}

	/**
	 * Handle global/workspace configuration changes.
	 */
	onDidChangeConfiguration() {
		if (this.setContexts) {
			this.setContexts();
		}
	}

	/**
	 * Set (or re-set) contexts
	 */
	setContexts(initial) {
		this.setContext(Push.contexts.hasUploadQueue, this.config.uploadQueue);
		this.setContext(Push.contexts.showTitleMenuUpload, this.config.showTitleMenuUpload);

		if (initial === true) {
			this.setContext(Push.contexts.initialised, true);
			this.setContext(Push.contexts.hasServiceContext, false);
		}
	}

	/**
	 * Initialises the service class.
	 */
	initService() {
		this.service = new Service({
			onDisconnect: (hadError) => {
				this.stopCancellableQueues(!!hadError, !!hadError);
			},
			onServiceFileUpdate: (uri) => {
				this.event('onServiceFileUpdate', uri);
			}
		});
	}

	/**
	 * Adds the files in the current Git working copy to the upload queue.
	 * @param {Uri} uri - Contextual Uri.
	 * @param {boolean} [exec=`false`] - `true` to immediately upload, `false` to queue.
	 */
	queueGitChangedFiles(uri, exec = false) {
		return this.scm.exec(
			SCM.providers.git,
			this.paths.getCurrentWorkspaceRootPath(uri, true),
			'listWorkingUris'
		).then((uris) => {
			if (exec) {
				// Immediately execute uploads
				return this.transfer(uris, 'put');
			}

			// Queue uploads
			return this.queueForUpload(uris);
		});
	}

	queueGitCommitChanges(uri, exec = false) {
		let dir = this.paths.getCurrentWorkspaceRootPath(uri, true);

		return this.scm.exec(
			SCM.providers.git,
			dir,
			'listCommits',
			10
		)
			.then((commits) => vscode.window.showQuickPick(commits, {
				placeholder: 'placeholder'
			}))
			.then((option) => {
				// Get Uris from the selected commit
				let result = { option };

				if (!option) {
					throw undefined;
				}

				return this.scm.exec(
					SCM.providers.git,
					dir,
					'urisFromCommit',
					option.baseOption
				).then((uris) => {
					result.uris = uris;
					return result;
				});
			})
			.then((result) => {
				// Filter Uris by ignoreGlobs
				return this.paths.filterUrisByGlobs(
					result.uris,
					this.config.ignoreGlobs
				).then(({ uris, ignored }) => {
					result.uris = uris;
					result.ignored = ignored;
					return result;
				});
			})
			.then((result) => {
				if (!result.uris.length) {
					if (result.ignored) {
						return utils.showLocalisedWarning(
							'commit_no_files_with_ignore',
							result.option.shortCommit,
							result.ignored
						);
					}

					return utils.showLocalisedWarning(
						'commit_no_files',
						result.option.shortCommit
					);
				}

				if (exec) {
					// Immediately execute uploads
					return this.transfer(result.uris, 'put');
				}

				// Queue uploads
				return this.queueForUpload(result.uris);
			});
	}

	/**
	 * Handle generic events (with a uri) and return settings.
	 * @param {string} eventType - Type of event, mainly for logging.
	 * @param {*} data
	 * @returns {object} settings object, obtained from the uri.
	 */
	event(eventType, data) {
		let uri, method, args, settings;

		switch (eventType) {
		case 'onDidSaveTextDocument':
			if (!this.paths.pathInWorkspaceFolder(data.uri)) {
				// Do nothing with files outside of the workspace
				return;
			}

			uri = data && data.uri;
			method = 'didSaveTextDocument';
			args = [data];
			break;

		case 'onDidChangeActiveTextEditor':
			if (!data) {
				data = vscode.window.activeTextEditor;
			}

			uri = (data && data.document && data.document.uri);
			method = 'didChangeActiveTextEditor';
			args = [data];
			break;

		case 'onServiceFileUpdate':
			uri = data;
			break;

		default:
			throw new Error('Unrecognised event type');
		}

		utils.trace('Push#event', eventType);

		if (!uri) {
			// Bail if there's no uri
			this.setEnvStatus(false);
			return;
		}

		if (
			eventType === 'onServiceFileUpdate' ||
			!this.service.settings.isSettingsFile(uri)
		) {
			// Get current server settings for the editor
			settings = this.service.settings.getServerJSON(
				uri,
				this.config.settingsFileGlob,
				true,
				true
			);

			if (this.config.useEnvLabel && settings && settings.data.env) {
				// Check env state and add to status
				this.setEnvStatus(settings.data.env);
			} else {
				this.setEnvStatus(false);
			}
		} else {
			this.setEnvStatus(false);
		}

		if (method) {
			this[method].apply(this, args.concat([settings]));
		}
	}

	/**
	 * Handle text document save events
	 * @param {textDocument} textDocument
	 */
	didSaveTextDocument(textDocument, settings) {
		if (!textDocument.uri || !this.paths.isValidScheme(textDocument.uri)) {
			// Empty or invalid URI
			return false;
		}

		utils.trace(
			'Push#didSaveTextDocument',
			`Text document saved at ${textDocument.uri.fsPath}`
		);

		this.service.settings.clear();

		if (this.config.uploadQueue && settings) {
			// File being changed is within a service context - queue for uploading
			this.queueForUpload(textDocument.uri)
				.then(() => {
					if (this.config.autoUploadQueue) {
						this.execUploadQueue();
					}
				});
		}
	}

	didChangeActiveTextEditor(textEditor, settings) {
		let uploadQueue = this.getQueue(Push.queueDefs.upload, false);

		if (
			!textEditor ||
			!textEditor.document ||
			!this.paths.isValidScheme(textEditor.document.uri)
		) {
			// Bail if there's still no editor, or no document
			return;
		}

		utils.trace(
			'Push#didChangeActiveTextEditor',
			`Editor switched to ${textEditor.document.uri.fsPath}`
		);

		this.setContext(
			Push.contexts.hasServiceContext,
			!!settings
		);

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
	 * @param {Uri} uriContext
	 */
	configWithServiceSettings(uriContext) {
		return this.service.settings.mergeWithServiceSettings(
			uriContext,
			this.config.settingsFileGlob,
			this.config
		);
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

		utils.trace('Push#queue', `Adding ${tasks.length} task(s)`);

		// Add initial init to a new queue
		if (queue.tasks.length === 0 && !queue.running) {
			utils.trace('Push#queue', 'Adding initial queue task');
			queue.addTask(new QueueTask(() => {
				// Run init with length - 1 (allowing for init task which is always first)
				return this.service.activeService &&
					this.service.activeService.init((queue.tasks.length - 1));
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
						// Execute the service method, returning any results and/or promises
						return this.service.exec(
							task.method,
							this.configWithServiceSettings(task.uriContext),
							task.args
						)
							.then((result) => {
								if (typeof task.onTaskComplete === 'function') {
									task.onTaskComplete.call(this, result);
								}

								return result;
							});
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
		if (!this.service) {
			return Promise.reject('No service set.');
		}

		if (!Array.isArray(uris)) {
			// Force uris to an array
			uris = [uris];
		}

		return Promise.all(uris.map(uri => {
			let remotePath;

			remotePath = this.service.execSync(
				'convertUriToRemote',
				this.configWithServiceSettings(uri),
				[uri]
			);

			return this.paths.filterUriByGlobs(uri, this.config.ignoreGlobs)
				.then((filteredUri) => {
					if (!filteredUri) {
						return;
					}

					this.queue(
						[{
							method: 'put',
							actionTaken: 'uploaded',
							uriContext: uri,
							args: [uri, remotePath],
							id: remotePath + this.paths.getNormalPath(uri)
						}],
						false,
						Push.queueDefs.upload,
						{
							showStatus: true,
							statusToolTip: (num) => {
								return i18n.t('num_to_upload', num);
							},
							statusCommand: 'push.uploadQueuedItems',
							emptyOnFail: false
						}
					);
				});
		}));
	}

	/**
	 * @description
	 * Copies the "upload" queue over to the default queue and runs the default queue.
	 * The upload queue is then emptied once the default queue has completed without
	 * errors.
	 * @returns {Promise} Promise, resolving when the queue is complete.
	 */
	execUploadQueue() {
		return new Promise((resolve, reject) => {
			let uploadQueue, queue;

			if (!this.config.uploadQueue) {
				channel.appendLocalisedInfo('upload_queue_disabled');
				return reject('Upload queue disabled.');
			}

			uploadQueue = this.getQueue(Push.queueDefs.upload);

			if (uploadQueue.tasks.length) {
				queue = this.queue(uploadQueue.tasks, true);

				if (queue instanceof Promise) {
					queue.then(() => {
						uploadQueue.empty();
					})
						.then(resolve);
				}
			} else {
				utils.showWarning(i18n.t('queue_empty'));
				return reject('Queue empty.');
			}
		});
	}

	/**
	 * Compares a local file with the remote equivalent using the service mapping rules.
	 * @param {Uri} uri - Uri of the local file to compare.
	 */
	diffRemote(uri) {
		return new Promise((resolve, reject) => {
			let tmpFile, remotePath;

			tmpFile = utils.getTmpFile();

			remotePath = this.service.execSync(
				'convertUriToRemote',
				this.configWithServiceSettings(uri),
				[uri]
			);

			// Use the queue to get a file then diff it
			this.queue([{
				method: 'get',
				actionTaken: 'downloaded',
				uriContext: uri,
				args: [
					tmpFile,
					remotePath,
					'overwrite'
				],
				id: tmpFile + remotePath,
				onTaskComplete: (result) => {
					if (result.error) {
						return;
					}

					vscode.commands.executeCommand(
						'vscode.diff',
						tmpFile,
						uri,
						`${i18n.t('server_v_local')} (${this.paths.getBaseName(uri)})`
					);
				}
			}], true, Push.queueDefs.diff).then(resolve, reject);
		});
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
			// Queue doesn't exist by ID
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
	 * @returns {Promise<object>} A promise, eventually resolving once the queue
	 * is complete, containing a result object.
	 */
	execQueue(queueDef) {
		const queue = this.getQueue(queueDef);

		if (queue.running) {
			return Promise.resolve();
		}

		// TODO: make channel clearing an option to turn on
		// channel.clear();

		// Fetch and execute queue
		return queue
			.exec(this.service.getStateProgress)
			.then((result) => {
				let log;

				if (
					result &&
					(log = result[QUEUE_LOG_TYPES.success]) &&
					(log.uploaded && log.uploaded.length)
				) {
					// Clear result items from "upload" queue
					this.remoteQueuedItemsByTransfer(
						Push.queueDefs.upload,
						log.uploaded
					);
				} else {
					this.refreshExplorerQueues();
				}

				return result;
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
	 * Removes items from a queue matching the TransferResult paths.
	 * @param {object} queueDef - One of the Push.queueDefs items.
	 * @param {TransferResult[]} transferResults - Results to draw Uris from.
	 */
	remoteQueuedItemsByTransfer(queueDef, transferResults) {
		let queue = this.getQueue(queueDef, false);

		if (queue) {
			transferResults.forEach(result => queue.removeTaskByUri(result.src));
			this.refreshExplorerQueues();
		}
	}

	/**
	 * Removes a single item from a queue by its Uri.
	 * @param {object} queueDef - One of the Push.queueDefs items.
	 * @param {uri} uri - Uri of the item to remove.
	 */
	removeQueuedUri(queueDef, uri) {
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
		this.explorers.uploadQueue.refresh(this.queues);
	}

	/**
	 * Refresh the Push explorer watch list data.
	 */
	onWatchUpdate(watchList) {
		this.explorers.watchList.refresh(watchList);
	}

	/**
	 * Handles a general Watch change event
	 * @param {Uri} uri - The Uri of the changed file.
	 */
	onWatchChange(uri) {
		if (this.config.queueWatchedFiles) {
			this.queueForUpload(uri);
		} else {
			this.upload(uri);
		}
	}

	/**
	 * Sets the VS Code context for general Push states
	 * @param {string} context - Context item name
	 * @param {mixed} value - Context value
	 */
	setContext(context, value) {
		utils.trace('Push#setContext', `${context}: "${value}"`);
		vscode.commands.executeCommand('setContext', `push:${context}`, value);
		return this;
	}

	/**
	 * Set the environment status message in the status bar
	 * @param {*} env
	 */
	setEnvStatus(env = '') {
		utils.trace('Push#setEnvStatus', `Setting environment label to ${env}`);

		this.clearTimedExecution(Push.globals.ENV_TIMER_ID);

		if (env) {
			if (!this.statusEnv) {
				// Create status for active environment
				this.statusEnv = vscode.window.createStatusBarItem(
					vscode.StatusBarAlignment.Left,
					STATUS_PRIORITIES.ENV
				);
			}

			this.statusEnv.text = '$(versions) ' + env;
			this.statusEnv.tooltip = i18n.t('env_tooltip', env);
			this.statusEnv.command = 'push.setServiceEnv';

			if (this.config.envColours[env]) {
				this.statusEnv.color = this.config.envColours[env];
			} else {
				this.statusEnv.color = ENV_DEFAULT_STATUS_COLOR;
			}

			this.statusEnv.show();
		} else {
			if (this.statusEnv) {
				// Hide the env status label, if it's been created
				this.statusEnv.hide();
			}
		}
	}

	/**
	 * Stop any current queue operations.
	 * @param {boolean} force - Set `true` to force any current operations to stop.
	 * @param {boolean} silent - Set `true` to create no notices when stopping the queue.
	 */
	stopCancellableQueues(force = false, silent = false) {
		let tasks = [],
			def, queue;

		for (def in Push.queueDefs) {
			if (
				(queue = this.getQueue(Push.queueDefs[def])) &&
				Push.queueDefs[def].cancellable &&
				queue.running
			) {
				tasks.push(
					this.stopQueue(Push.queueDefs[def], force, silent)
				);
			}
		}

		return Promise.all(tasks);
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
		let queue = this.getQueue(queueDef);

		return vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			title: 'Push'
		}, (progress) => {
			return new Promise((resolve, reject) => {
				let tasks = [],
					timer;

				progress.report({ message: i18n.t('stopping') });
				utils.trace('Push#stopQueue', 'Stopping queue');

				if (force) {
					// Give X seconds to stop or force by restarting the active service
					utils.trace('Push#stopQueue', 'Starting queue force stop');

					// Set up timer for force stopping the queue after x seconds
					timer = setTimeout(() => {
						// Force stop the queue
						utils.trace(
							'Push#stopQueue',
							Push.globals.FORCE_STOP_TIMEOUT +
								' second(s) elapsed. Force stopping queue'
						);

						// Silently force complete the queue
						queue.stop(true, true, true);

						// Force restart the active service
						this.service.restartServiceInstance();

						// Show the error
						!silent && channel.appendError(i18n.t(
							'queue_force_stopped',
							queueDef.id,
							Push.globals.FORCE_STOP_TIMEOUT
						));

						// Reject the outer promise - this is a lost cause
						reject('Queue force stopped.');
					}, ((Push.globals.FORCE_STOP_TIMEOUT * 1000)));
				}

				// Stop the queue
				tasks.push(
					queue.stop()
						.then((result) => {
							utils.trace('Push#stopQueue', 'Queue stop resolve');

							!silent && channel.appendLocalisedInfo(
								'queue_cancelled',
								queueDef.id
							);

							return result;
						})
						.catch((error) => {
							utils.trace('Push#stopQueue', 'Queue stop reject');
							reject(error);
						})
				);

				if (force) {
					// Stop the service as well
					utils.trace('Push#stopQueue', 'Adding force stop task');
					tasks.push(
						this.service.stop()
					);
				}

				// Resolve the outer promise (and clear the timeout) when all
				// of the tasks have finished. The outer promise can also be rejected
				// by the timeout (see above).
				Promise.all(tasks)
					.then((results) => {
						utils.trace('Push#stopQueue', 'Queue stop tasks complete');
						clearTimeout(timer);
						resolve(results[0]);
					})
					.catch((error) => {
						utils.trace('Push#stopQueue', 'Queue stop tasks failed');
						clearTimeout(timer);
						reject(error);
					});
			});
		});
	}

	/**
	 * Transfers a single file or array of single files.
	 * @param {Uri[]} uris - Uri or array of Uris of file(s) to transfer.
	 * @param {string} method - Either 'get' or 'put'.
	 * @returns {Promise} A promise, resolving when the file has transferred.
	 */
	transfer(uris, method) {
		let ignoreGlobs = [],
			tasks = [],
			action, actionTaken;

		this.service.settings.clear();

		if (typeof uris === 'undefined') {
			throw new Error('No files defined.');
		}

		if (!Array.isArray(uris)) {
			uris = [uris];
		}

		// Check there are no directories
		uris.forEach((uri) => {
			if (this.paths.isDirectory(uri)) {
				throw new Error(`Path "${uri.path}" is a directory and cannot be transferred with Push#transfer.`);
			}
		});

		if (method === 'put') {
			action = 'upload';
			actionTaken = 'uploaded';

			// Filter Uri by the ignore globs when uploading
			ignoreGlobs = this.config.ignoreGlobs;
		} else if (method === 'get') {
			action = 'download';
			actionTaken = 'downloaded';
		} else {
			throw new Error(`Unknown method "${method}"`);
		}

		uris.forEach((uri, index) => {
			// Check the source file is a usable scheme
			if (!this.paths.isValidScheme(uri)) {
				return;
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
			tasks.push(((uri) => {
				let config, remotePath;

				if (!(config = this.configWithServiceSettings(uri))) {
					return false;
				}

				return this.paths.filterUriByGlobs(uri, ignoreGlobs)
					.then((filteredUri) => {
						if (filteredUri !== false) {
							// Uri is not being ignored. Continue...
							remotePath = this.service.execSync(
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
			})(uri));
		});

		if (tasks.length) {
			return Promise.all(tasks);
		}

		return Promise.resolve();
	}

	/**
	 * Transfers a directory of files.
	 * @param {Uri} uri - Uri of the directory to transfer.
	 * @param {*} method - Either 'get' or 'put'.
	 * @returns {Promise} A promise, resolving when the directory has transferred.
	 */
	transferDirectory(uri, method) {
		let ignoreGlobs = [], actionTaken, config, remoteUri;

		// Check the source directory is a usable scheme
		if (!this.paths.isValidScheme(uri)) {
			return false;
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

		remoteUri = this.service.execSync(
			'convertUriToRemote',
			config,
			[uri]
		);

		utils.trace('Push#transferDirectory', `Transfering ${uri.fsPath} (${method})`);

		if (method === 'put') {
			// Recursively list local files and transfer each one
			return this.paths.getDirectoryContentsAsFiles(
				uri,
				ignoreGlobs,
				config.service.followSymlinks
			)
				.then((files) => {
					utils.trace(
						'Push#transferDirectory',
						`Found ${files.length} file(s) on local`
					);

					let tasks = files.map((uri) => {
						let remotePath;

						uri = vscode.Uri.file(uri);

						remotePath = this.service.execSync(
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
					utils.trace(
						'Push#transferDirectory',
						'Found ${files.length} file(s) on remote'
					);

					let tasks = files.map((file) => {
						let uri;

						file = file.pathName || file;
						uri = this.service.execSync(
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
				`${this.paths.getNormalPath(uri)}/**/${this.config.settingsFileGlob}`
			)
				.then((files) => {
					if (files.length > 1) {
						// More than one settings file found within the current directory
						reject(new PushError(i18n.t('multiple_service_files_no_transfer')));
					} else {
						// 1 or less file found
						resolve(uri);
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
	 * @returns {Uri} The Uri uri, if. Will throw a PushError otherwise.
	 */
	getValidUri(uri) {
		uri = this.paths.getFileSrc(uri);

		if (uri === null) {
			// Uri could not be found *at all*
			utils.showError(i18n.t('invalid_path_anonymous'));
			return false;
		}

		if (!this.paths.isValidPath(uri)) {
			utils.showError(i18n.t('invalid_path', uri.scheme));
			return false;
		}

		if (!this.paths.isValidScheme(uri)) {
			utils.showError(i18n.t('invalid_uri_scheme', uri.scheme));
			return false;
		}

		return uri;
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
	FORCE_STOP_TIMEOUT: 5, // In seconds
	ENV_TIMER_ID: 'env-switch',
	VERSION_STORE: 'Push:version'
};

Push.contexts = {
	hasUploadQueue: 'hasUploadQueue',
	initialised: 'initialised',
	activeEditorInUploadQueue: 'activeEditorInUploadQueue',
	hasServiceContext: 'hasServiceContext',
	showTitleMenuUpload: 'showTitleMenuUpload'
};

module.exports = Push;
