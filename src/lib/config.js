const vscode = require('vscode');

const tools = require('./tools');

module.exports = {
	/**
	 * Returns the current config, with any required augmentations made.
	 * @param {string} item - Retrieve a single configuration item
	 */
	get: function(item) {
		let config = Object.assign(
				{},
				vscode.workspace.getConfiguration(
					'njpPush',
					vscode.window.activeTextEditor &&
					vscode.window.activeTextEditor.document.uri
				)
			),
			settingsGlob;

		// Augment configuration with computed settings
		if ((!item || item === 'ignoreGlobs') && Array.isArray(config.ignoreGlobs)) {
			settingsGlob = `**/${config.settingsFileGlob}`;
			config.ignoreGlobs.push(settingsGlob);
			// Ensure glob list only contains unique values
			config.ignoreGlobs = tools.uniqArray(config.ignoreGlobs);
		}

		if (item) {
			return config[item] || null;
		}

		return config;
	}
};
