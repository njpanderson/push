const vscode = require('vscode');

const ServiceSettings = require('./lib/ServiceSettings');
const Service = require('./lib/Service');
const Paths = require('./lib/Paths');
const Queue = require('./lib/Queue');
const Watch = require('./lib/Watch');
const utils = require('./lib/utils');
const channel = require('./lib/channel');
const constants = require('./lib/constants');

/**
 * Provides a normalised interface for the command panel and contextual menus.
 */
class Push {
	constructor() {
		this.setConfig = this.setConfig.bind(this);
		this.didSaveTextDocument = this.didSaveTextDocument.bind(this);

		this.settings = new ServiceSettings();
		this.service = new Service({
			onDisconnect: () => {
				this.stopCancellableQueues();
			}
		});

		this.paths = new Paths();
		this.watch = new Watch();

		this.config = null;

		this.queues = {};

		// Set initial config
		this.setConfig();

		// Create event handlers
		vscode.workspace.onDidChangeConfiguration(this.setConfig);
		vscode.workspace.onDidSaveTextDocument(this.didSaveTextDocument);

		// Set initial contexts
		this.setContext(Push.contexts.queueInProgress, false);
		this.setContext(Push.contexts.initialised, true);
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

	/**
	 * Discover differences between the local and remote file.
	 * @param {Uri} uri
	 */
	diff(uri) {
		let config, tmpFile;

		uri = this.paths.getFileSrc(uri);
		tmpFile = this.paths.getTmpFile();
		config = this.configWithServiceSettings(uri);

		this.service.exec(
			'get',
			config,
			[
				tmpFile,
				this.service.exec(
					'convertUriToRemote',
					config,
					[uri]
				),
				'overwrite'
			]
		).then(() => {
			vscode.commands.executeCommand(
				'vscode.diff',
				tmpFile,
				uri,
				'Diff: ' + this.paths.getBaseName(uri)
			);
		}).catch((error) => {
			channel.appendError(error);
		});
	}

	/**
	 * @description
	 * Watches the files within the supplied Uri path and uploads them whenever
	 * a change is detected
	 * @param {Uri} uri - Folder/File Uri to watch.
	 */
	addWatch(uri) {
		this.watch.add(this.paths.getFileSrc(uri), (uri) => {
			this.upload(uri);
		});
	}

	/**
	 * Removes an existing watch from a Uri.
	 * @param {Uri} uri - Folder/File Uri to stop watching.
	 */
	removeWatch(uri) {
		this.watch.remove(this.paths.getFileSrc(uri));
	}

	listWatchers() {
		this.watch.list();
	}

	/**
	 * Starts the internal watch process and watches the blobs.
	 */
	startWatch() {
		this.watch.toggle(true);
	}

	/**
	 * Stops the internal watch process.
	 */
	stopWatch() {
		this.watch.toggle(false);
	}

	/**
	 * Clear all (active or disabled) watchers
	 */
	clearWatchers() {
		this.watch.clear();
	}

	/**
	 * Edits (or creates) a server configuration file
	 * @param {Uri} uri - Uri to start looking for a configuration file
	 */
	editServiceConfig(uri) {
		let rootPaths, dirName, settingsFile;

		uri = this.paths.getFileSrc(uri);
		dirName = this.paths.getDirName(uri, true);

		// Find the nearest settings file
		settingsFile = this.paths.findFileInAncestors(
			this.config.settingsFilename,
			dirName
		);

		if (dirName !== ".") {
			// If a directory is defined, use it as the root path
			rootPaths = [{
				uri: vscode.Uri.file(dirName)
			}]
		} else {
			rootPaths = this.paths.getWorkspaceRootPaths();
		}

		if (settingsFile) {
			// Edit the settings file found
			this.openDoc(settingsFile);
		} else {
			// Produce a prompt to create a new settings file
			this.getFileNamePrompt(this.config.settingsFilename, rootPaths)
				.then((file) => {
					if (file.exists) {
						this.openDoc(file.fileName);
					} else {
						this.writeAndOpen(
							constants.DEFAULT_SERVICE_CONFIG,
							file.fileName
						);
					}
				});
		}
	}

	writeAndOpen(content, fileName) {
		// Write a file then open it
		this.paths.writeFile(
			content,
			fileName
		)
			.then((fileName) => {
				this.openDoc(fileName);
			})
			.catch((error) => {
				channel.appendError(error);
			});
	}

	getFileNamePrompt(exampleFileName, rootPaths, forceDialog = false) {
		return new Promise((resolve, reject) => {
			this.getRootPathPrompt(rootPaths)
				.then((rootPath) => {
					let fileName = rootPath + Paths.sep + exampleFileName;

					if (rootPath) {
						if (this.paths.fileExists(fileName) && !forceDialog) {
							resolve({ fileName, exists: true });
						} else {
							vscode.window.showInputBox({
								prompt: 'Enter a filename for the service settings file:',
								value: fileName
							}).then((fileName) => {
								if (fileName) {
									resolve({
										fileName,
										exists: this.paths.fileExists(fileName)
									});
								} else {
									reject();
								}
							});
						}
					} else {
						reject();
					}
				});
		});
	}

	/**
	 * Will either prompt the user to select a root path, or in the case that
	 * only one `rootPaths` element exists, will resolve to that path.
	 * @param {vscode.WorkspaceFolder[]} rootPaths
	 * @returns {promise} A promise eventually resolving to a single Uri.
	 */
	getRootPathPrompt(rootPaths) {
		return new Promise((resolve) => {
			if (typeof rootPaths === 'string') {
				resolve(rootPaths);
				return;
			}

			if (rootPaths.length > 1) {
				// First, select a root path
				vscode.window.showQuickPick(
					rootPaths.map((item) => this.paths.getNormalPath(item.uri)),
					{
						placeHolder: 'Select a workspace root path:'
					}
				).then(resolve);
			} else {
				resolve(this.paths.getNormalPath(rootPaths[0].uri));
			}
		});
	}

	/**
	 * Imports a configuration file from Sublime SFTP
	 * @param {Uri} uri - Uri to start looking for a configuration file
	 * @param {string} type - Type of config to import. Currently only 'SSFTP'
	 * is supported.
	 */
	importConfig(uri) {
		let className, pathName, basename, instance, settings;

		pathName = this.paths.getNormalPath(this.paths.getFileSrc(uri));

		if (!(basename = this.paths.getBaseName(pathName))) {
			channel.appendError(utils.strings.NO_IMPORT_FILE);
		}

		// Figure out which config type this is and import
		for (className in constants.CONFIG_FORMATS) {
			if (constants.CONFIG_FORMATS[className].test(basename)) {
				className = require(`./lib/importers/${className}`);
				instance = new className();

				return instance.import(pathName)
					.then((result) => {
						settings = result;

						return this.getFileNamePrompt(
							this.config.settingsFilename,
							this.paths.getDirName(pathName),
							true
						);
					})
					.then((result) => {
						if (result.exists) {
							// Settings file already exists at this location!
							return vscode.window.showInformationMessage(
								utils.strings.SETTINGS_FILE_EXISTS,
								{
									title: 'Overwrite'
								}, {
									isCloseAffordance: true,
									title: 'Cancel'
								}
							).then((collisionAnswer) => ({
								fileName: result.fileName,
								write: (collisionAnswer.title === 'Overwrite')
							}));
						} else {
							// Just create and open
							return({ fileName: result.fileName, write: true });
						}
					})
					.then((result) => {
						if (result.write) {
							// Write the file
							this.writeAndOpen(
								`\/\/ Settings imported from ${pathName}\n` +
								JSON.stringify(settings, null, '\t'),
								result.fileName
							);
						}
					})
					.catch((error) => {
						channel.appendError(error);
					});
			}
		}

		channel.appendError(utils.strings.IMPORT_FILE_NOT_SUPPORTED);
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
		this.config = utils.getConfig();
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
	 * Opens a text document and displays it within the editor window.
	 * @param {string|Uri} file - File to open. Must be local.
	 */
	openDoc(file) {
		let document;

		// Shows the document as an editor tab
		function show(document) {
			vscode.window.showTextDocument(
				document,
				{
					preview: true,
					preserveFocus: false
				}
			);
		}

		// Convert string (or invalid scheme) into a Uri with a scheme of "file"
		if (!(file instanceof vscode.Uri) || file.scheme !== 'file') {
			file = vscode.Uri.file(this.paths.getNormalPath(file));
		}

		// Find and open document
		document = vscode.workspace.openTextDocument(file);

		if (document instanceof Promise) {
			// Document is opening, wait and display
			document.then(show)
			.catch((error) => {
				channel.appendError(error);
				throw error;
			});
		} else {
			// Display immediately
			show(document);
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

		// Fetch and execute queue
		return this.getQueue(queueDef)
			.exec(this.service.getStateProgress)
				.then(() => {
					// Set contextual state that the queue has completed
					this.setContext(Push.contexts.queueInProgress, false);
				})
				.catch((error) => {
					// Set contextual state that the queue has completed
					this.setContext(Push.contexts.queueInProgress, false);
					throw error;
				});
	}

	setContext(context, value) {
		vscode.commands.executeCommand('setContext', `push:${context}`, value);
		return this;
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
						resolve(result);
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
						uri = vscode.Uri.file(uri);

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
						// More than one settings file found within the current directory
						channel.appendError(
							utils.strings.MULTIPLE_SERVICE_FILES + ' ' +
							utils.strings.TRANSFER_NOT_POSSIBLE
						);

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

Push.contexts = {
	initialised: 'initialised',
	queueInProgress: 'queueInProgress'
};

module.exports = Push;