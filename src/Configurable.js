const vscode = require('vscode');

const workspaceConfig = require('./lib/config');

class Configurable {
	constructor() {
		this.setConfig = this.setConfig.bind(this);

		// Create event handlers
		vscode.workspace.onDidChangeConfiguration(() => this.setConfig());

		// Set the initial config
		this.setConfig();
	}

	setConfig(config) {
		let oldConfig;

		this.config && (oldConfig = Object.assign({}, this.config));
		this.config = config || workspaceConfig.get();

		if (oldConfig) {
			// Old config exists, fire onDidChange method.
			this.onDidChangeConfiguration(this.config, oldConfig);
		}
	}

	/**
	 * Fired whenever the config changes in any way.
	 * @param {object} config - The new, current configuration.
	 * @param {object|undefined} oldConfig - The previous configuration.
	 */
	onDidChangeConfiguration() {
		// Does nothing in the base class
	}
}

module.exports = Configurable;
