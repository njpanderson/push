const vscode = require('vscode');
const tmp = require('tmp');
const fs = require('fs');

const config = require('./config');
const PushError = require('./types/PushError');
const i18n = require('../i18n');
const channel = require('./channel');
const {
	TMP_FILE_PREFIX,
	PUSH_MESSAGE_PREFIX,
	DEBUG
} = require('./constants');

const utils = {
	_timeouts: {},
	_filenameRegexCache: {},
	_sb: null,
	traceCounter: 0,

	/**
	 * Show an informational message using the VS Code interface
	 * @param {string} message - Message to display.
	 */
	showMessage(message) {
		utils.displayErrorOrString('showInformationMessage', message);
	},

	/**
	 * @description
	 * Show a localised informational message using the VS Code interface.
	 * Recieves the same arguments as i18n#t
	 * @see i18n#t
	 */
	showLocalisedMessage() {
		utils.showMessage(i18n.t.apply(i18n, [...arguments]));
	},

	/**
	 * Show an error message using the VS Code interface
	 * @param {string} message - Message to display.
	 */
	showError(message) {
		utils.displayErrorOrString('showErrorMessage', message);
	},

	/**
	 * Show a warning message using the VS Code interface
	 * @param {string} message - Message to display.
	 */
	showWarning(message) {
		utils.displayErrorOrString('showWarningMessage', message);
	},

	/**
	 * @description
	 * Show a localised warning message using the VS Code interface.
	 * Recieves the same arguments as i18n#t
	 * @see i18n#t
	 */
	showLocalisedWarning() {
		utils.showWarning(i18n.t.apply(i18n, [...arguments]));
	},

	/**
	 * Show a status message, optionally removing it after x seconds.
	 * @param {string} message - Message to show
	 * @param {number} [removeAfter=0] - How many seconds to wait before removing the
	 * message. Leave at 0 for a permanent message.
	 * @param {string} [color='green'] - Colour of the message.
	 * @returns vscode.StatusBarItem
	 */
	showStatusMessage(message, removeAfter = 0, color = null) {
		this.hideStatusMessage();

		if (!color) {
			color = new vscode.ThemeColor(config.get('statusMessageColor'));
		}

		this._sb = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.left,
			1
		);

		this._sb.text = message;
		this._sb.color = color;
		this._sb.show();

		if (removeAfter !== 0) {
			if (this._timeouts.sb) {
				clearTimeout(this._timeouts.sb);
			}

			this._timeouts.sb = setTimeout(() => {
				this.hideStatusMessage();
				this._timeouts.sb = null;
			}, (removeAfter * 1000));
		}

		return this._sb;
	},

	/**
	 * Hides any currently active status message.
	 */
	hideStatusMessage() {
		if (this._sb) {
			this._sb.dispose();
		}
	},

	/**
	 * Display an Error object or string using the VS code interface.
	 * @param {string} method - Method to use (one of `showXXXMessage` methods).
	 * @param {error|string} data - Data to display.
	 */
	displayErrorOrString(method, data) {
		if (data instanceof Error) {
			vscode.window[method](PUSH_MESSAGE_PREFIX + data.message);
		} else {
			vscode.window[method](PUSH_MESSAGE_PREFIX + data);
		}
	},

	showFileCollisionPicker(
		name,
		callback,
		queueLength = 0,
		placeHolder
	) {
		let options = [
			utils.collisionOpts.skip,
			utils.collisionOpts.rename,
			utils.collisionOpts.stop,
			utils.collisionOpts.overwrite,
		];

		placeHolder = placeHolder || i18n.t('filename_exists', name);

		if (queueLength > 1) {
			// Add "all" options if there's more than one item in the current queue
			options = options.concat([
				utils.collisionOptsAll.skip,
				utils.collisionOptsAll.rename,
				utils.collisionOptsAll.overwrite,
			]);
		}

		return new Promise((resolve) => {
			vscode.window.showQuickPick(
				options,
				{
					placeHolder,
					onDidSelectItem: callback
				}
			).then((option) => {
				resolve({ option, type: 'normal' });
			});
		});
	},

	showMismatchCollisionPicker(name, callback) {
		let options = [
				utils.collisionOpts.skip,
				utils.collisionOpts.rename,
				utils.collisionOpts.stop
			],
			placeHolder = i18n.t('filename_exists_mismatch', name);

		return new Promise((resolve) => {
			vscode.window.showQuickPick(
				options,
				{
					placeHolder,
					onDidSelectItem: callback
				}
			).then((option) => {
				resolve({ option, type: 'mismatch_type' });
			});
		});
	},

	trimSeparators: function(pathname, separator = '/') {
		const re = new RegExp('^' + separator + '+|\\' + separator + '+$', 'g');
		return pathname.trim(re, '');
	},

	/**
	 * Adds an OS-specific trailing separator to a path (unless the path
	 * consists solely of a separator).
	 */
	addTrailingSeperator(pathname, separator = '/') {
		if (!pathname.endsWith(separator)) {
			return pathname + separator;
		}

		return pathname;
	},

	/**
	 * Adds an OS-specific leading separator to a path (unless the path
	 * consists solely of a separator).
	 */
	addLeadingSeperator(pathname, separator = '/') {
		if (!pathname.startsWith(separator)) {
			return pathname + pathname;
		}

		return pathname;
	},

	/**
	 * Writes to a file from stream data.
	 * @param {stream} read - Readable Stream stream object.
	 * @param {string} filename - Absolute filename to write to.
	 * @param {boolean} useTmpFile - Whether to use a temporary file or write
	 * directly to the target file.
	 * @returns {Promise} Resolving on success, rejecting on failure
	 */
	writeFileFromStream(read, writeFilename, readFilename = '', useTmpFile = true) {
		return new Promise((resolve, reject) => {
			let writeFile = writeFilename,
				streamError, write;

			if (useTmpFile) {
				writeFile = this.getTmpFile(false);
			}

			write = fs.createWriteStream(writeFile);

			function cleanUp(error) {
				streamError = error;

				read.destroy();
				write.end();
			}

			// Set up write stream
			write.on('error', (error) => {
				cleanUp(error);

				reject(i18n.t(
					'stream_write',
					writeFile,
					(error && error.message)
				));
			});

			write.on('finish', () => {
				// Writing has finished (and thusly so has reading)
				let tmpRead;

				if (streamError) {
					return;
				}

				if (!useTmpFile) {
					return resolve();
				}

				tmpRead = fs.createReadStream(writeFile);

				// Copy file from temporary file to the required location
				this.writeFileFromStream(tmpRead, writeFilename, readFilename, false)
					.then(resolve, reject);
			});

			// Set up read stream
			read.on('error', (error) => {
				cleanUp(error);

				reject(i18n.t(
					'stream_read',
					(readFilename != '') ? readFilename : null,
					(error && error.message)
				));
			});

			// Begin the stream transfer
			read.pipe(write);
		});
	},

	/**
	 * Create a temporary file and return its filename.
	 * @param {boolean} [getUri=true] - Whether to return a URI or a string.
	 * @param {string} [extension] - An extension to supply for determining the extension of the temporary file.
	 * @return {string} Filename created.
	 */
	getTmpFile(getUri = true, extension = null) {
		const tmpobj = tmp.fileSync({
			prefix: TMP_FILE_PREFIX,
			postfix: (typeof extension === 'string' ? extension : '.tmp')
		});

		if (getUri) {
			return vscode.Uri.file(tmpobj.name);
		}

		return tmpobj.name;
	},

	trace(id) {
		let args = [...arguments];

		if (DEBUG) {
			if (DEBUG.trace_allow && !DEBUG.trace_allow.test(id)) {
				return;
			}

			if (this.traceCounter > 100000) {
				this.traceCounter = 0;
				console.log('# (Counter reset)');
			}

			args = args.slice(1);

			if (args[args.length - 1] === true) {
				console.log('##########################');
				args = args.slice(0, args.length - 1);
			}

			console.log(
				`#${++this.traceCounter} ` +
				i18n.moment().format('HH:mm:ss.SS') +
				` [${id}] ${args.join(', ')}`
			);
		}
	},

	/**
	 * Escapes a string for safe use in a regular expression.
	 * @param {string} str - String to escape
	 */
	regexEscape(str) {
		// http://kevin.vanzonneveld.net
		// +   original by: booeyOH
		// +   improved by: Ates Goral (http://magnetiq.com)
		// +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
		// +   bugfixed by: Onno Marsman
		return (str + '').replace(/([\\.+*?[^\]$(){}=!<>|:])/g, '\\$1');
	},

	filePathRegex(filePath) {
		if (this._filenameRegexCache[filePath]) {
			return this._filenameRegexCache[filePath];
		}

		return this._filenameRegexCache[filePath] = new RegExp(this.regexEscape(filePath), 'i');
	},

	filePathReplace(filePath, searchFor, replaceWith) {
		return filePath.replace(this.filePathRegex(searchFor), replaceWith);
	},

	/**
	 * Opens a text document and displays it within the editor window.
	 * @param {string|Uri} file - File to open. Must be local.
	 */
	openDoc(file) {
		let document;

		// Shows the document as an editor tab
		function show(document) {
			return vscode.window.showTextDocument(
				document,
				{
					preview: true,
					preserveFocus: false
				}
			);
		}

		// Convert string into a file Uri
		if (!(file instanceof vscode.Uri)) {
			file = vscode.Uri.file(file);
		}

		// Find and open document
		document = vscode.workspace.openTextDocument(file);

		if (document instanceof Promise) {
			// Document is opening, wait and display
			return document.then(show)
				.catch((error) => {
					channel.appendError(error);
					throw error;
				});
		} else {
			// Display immediately
			return show(document);
		}
	},

	/**
	 * Will either prompt the user to select a root path, or in the case that
	 * only one `folders` element exists, will resolve to its path Uri.
	 * @param {vscode.WorkspaceFolder[]} folders
	 * @returns {Promise<Uri>} A promise eventually resolving to a single Uri.
	 */
	getRootPathPrompt(folders) {
		return new Promise((resolve) => {
			if (typeof folders === 'string') {
				resolve(folders);
				return;
			}

			if (folders.length > 1) {
				// First, select a root path
				vscode.window.showQuickPick(
					folders.map((item) => item.uri),
					{
						placeHolder: i18n.t('select_workspace_root')
					}
				).then(resolve);
			} else {
				resolve(folders[0].uri);
			}
		});
	}
};

utils.collisionOpts = {
	skip: i18n.o({ label: 'skip', detail: 'skip_transferring_default' }),
	stop: i18n.o({ label: 'stop', detail: 'stop_transfer_empty_queue' }),
	overwrite: i18n.o({ label: 'overwrite', detail: 'replace_target_with_source' }),
	rename: i18n.o({ label: 'rename', detail: 'keep_both_files_by_rename' })
};

utils.collisionOptsAll = {
	skip: Object.assign(i18n.o({
		label: 'skip_all',
		detail: 'skip_transferring_all_existing'
	}), {
		baseOption: utils.collisionOpts.skip
	}),
	overwrite: Object.assign(i18n.o({
		label: 'overwrite_all',
		detail: 'replace_all_existing'
	}), {
		baseOption: utils.collisionOpts.overwrite
	}),
	rename: Object.assign(i18n.o({
		label: 'rename_all',
		detail: 'keep_all_existing_by_renaming_all'
	}), {
		baseOption: utils.collisionOpts.rename
	})
};

utils.errors = {
	stop: new PushError(i18n.t('transfer_cancelled'))
};

module.exports = utils;
