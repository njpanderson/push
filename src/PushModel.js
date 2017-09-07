const vscode = require('vscode');

const Service = require('./lib/Service');

class PushModel {
	constructor() {
		this.setConfig = this.setConfig.bind(this);

		// Push extension configuration
		this.config = null;
		this.uriContext = '';

		// Set the initial configuration for the workspace
		this.setConfig();

		this.service = new Service(this.config);

		vscode.workspace.onDidChangeConfiguration(this.setConfig);
	}

	setUriContext(uri) {
		return (
			(this.uriContext = this.getFileSrc(uri)) &&
			this.service.setSettings(this.uriContext)
		);
	}

	getUriContextPath() {
		return this.uriContext && this.uriContext.path;
	}

	/**
	 * Retrieves a source file based on the workspace of the command.
	 * @param {object} uri - Source file URI
	 */
	getFileSrc(uri) {
		if (uri) {
			return uri;
		}

		// uri is not set or does not exist. attempt to get from the editor
		if (vscode.window.activeTextEditor) {
			return vscode.window.activeTextEditor &&
				vscode.window.activeTextEditor.document.uri;
		}

		return '';
	}

	setConfig(config) {
		this.config = config || this.getConfig();

		if (this.service) {
			// Re-set the service config
			this.service.setConfig();
		}
	}

	getConfig(key = null) {
		const config = vscode.workspace.getConfiguration(
			'njpPush',
			vscode.window.activeTextEditor.document.uri
		);

		if (key) {
			return config[key] || null;
		}

		return config;
	}
}

module.exports = PushModel;