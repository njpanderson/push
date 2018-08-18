const vscode = require('vscode');

const Configurable = require('./Configurable');
const Paths = require('./Paths');
const PushError = require('./PushError');
const channel = require('./channel');
const i18n = require('../lang/i18n');

class PushBase extends Configurable {
	constructor() {
		super();

		this.paths = new Paths();
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

	writeAndOpen(content, fileName) {
		// Write a file then open it
		if (typeof content !== 'string' && content.constructor === Object) {
			// Parse pure object content to JSON string
			content = JSON.stringify(content, null, '\t');
		}

		// Add comment to the top
		content =
			'// ' + i18n.t('comm_push_settings1', (new Date()).toString()) +
			'// ' + i18n.t('comm_push_settings2') +
			content;

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
						placeHolder: i18n.t('select_workspace_root')
					}
				).then(resolve);
			} else {
				resolve(this.paths.getNormalPath(rootPaths[0].uri));
			}
		});
	}

	/**
	 * Catches (and potentially throws) general errors.
	 * @param {Error} error - Any object, inheriting from Error.
	 */
	catchError(error) {
		if (error instanceof PushError) {
			// This is an expected exception, generated for user display.
			channel.appendError(error);
		} else {
			// This is an unexpected or uncaught exception.
			console.error(error);
			throw error;
			debugger;
		}
	}
};

module.exports = PushBase;
