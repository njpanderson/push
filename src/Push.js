const vscode = require('vscode');
const fs = require('fs');

const PushModel = require('./PushModel')

class Push {
	constructor() {
		this.model = new PushModel();
		this.settings = {};
		this.uriContext = '';
	}

	/**
	 * Routes to a command method after doing required up-front work.
	 * @param {string} method - Method name to execute
	 * @param {string} uriContext - Contextual file URI (or blank if none)
	 */
	command(method, uriContext, args) {
		this
			.setUriContext(uriContext)
			.setSettings(
				this.model.getSettingsJSON()
			);

		this[method].apply(this, args);
	}

	setUriContext(uri) {
		this.uriContext = this.getFileSrc(uri);
		return this;
	}

	setSettings(settings) {
		this.settings = settings;
		return this;
	}

	upload() {
		if (this.uriContext) {
			console.log(this.uriContext);
			vscode.window.showInformationMessage(`upload: ${this.uriContext} (${this.isFolder(this.uriContext)})`);
		}
	}

	download() {
		if (this.uriContext) {
			vscode.window.showInformationMessage(`download: ${this.uriContext} (${this.isFolder(this.uriContext)})`);
		}
	}

	isFolder(uri) {
		const stats = fs.statSync(uri.path);
		return stats.isDirectory();
	}

	/**
	 * Retrieves a source file based on the environment of the command.
	 * @param {string} src - Source file URI
	 */
	getFileSrc(src) {
		if (src) {
			return src;
		}

		if (vscode.window.activeTextEditor) {
			return vscode.window.activeTextEditor &&
				vscode.window.activeTextEditor.document.uri;
		}

		return '';
	}
}

module.exports = Push;