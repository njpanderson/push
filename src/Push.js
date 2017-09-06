const vscode = require('vscode');

const PushModel = require('./PushModel');

class Push {
	constructor(model) {
		this.model = new PushModel();

		vscode.workspace.onDidChangeConfiguration(this.model.configChange);
		vscode.workspace.onDidSaveTextDocument(this.model.checkServerSettingsChange);
	}

	upload() {
		if (this.model.uriContext) {
			this.model.execServiceMethod('put', this.model.uriContext.path);
		}
	}

	download() {
		if (this.model.uriContext) {
			vscode.window.showInformationMessage(
				`download: ${this.model.uriContext} (${this.model.isDirectory(this.model.uriContext)})`
			);
		}
	}

	getConfig(key) {
		return this.model.getConfig(key);
	}
}

module.exports = Push;