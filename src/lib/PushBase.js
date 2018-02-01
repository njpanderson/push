const vscode = require('vscode');

const Paths = require('./Paths');
const channel = require('./channel');
const utils = require('./utils');

class PushBase {
	constructor() {
		this.paths = new Paths();
		this.setConfig = this.setConfig.bind(this);

		// Set initial config
		this.setConfig();

		// Create event handlers
		vscode.workspace.onDidChangeConfiguration(this.setConfig);
	}

	/**
	 * Sets the current configuration for the active workspace.
	 */
	setConfig() {
		this.config = utils.getConfig();
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
			'// Push settings file - generated on ' + (new Date()).toString() + '\n' +
			'// Note: Comments are supported within Push settings files\n' +
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
						placeHolder: 'Select a workspace root path:'
					}
				).then(resolve);
			} else {
				resolve(this.paths.getNormalPath(rootPaths[0].uri));
			}
		});
	}
};

module.exports = PushBase;