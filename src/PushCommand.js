const vscode = require('vscode');

const Push = require('./Push');

/**
 * Provides a normalised interface for the command panel and contextual menus.
 */
class PushCommand {
	constructor() {
		this.upload = this.upload.bind(this);
		this.download = this.download.bind(this);

		this._push = new Push();
	}

	/**
	 * Routes to a Push method after doing required up-front work.
	 * @param {string} method - Method name to execute
	 * @param {object} uriContext - Contextual file URI (or blank if none)
	 */
	_route(method, uriContext, args) {
		let settings;

		if ((
			settings = this._push.model
				.setUriContext(uriContext)
		)) {
			if (!this._push.model.service) {
				// Show a service error
				vscode.window.showErrorMessage(
					`A transfer service was not defined within the settings file at ${settings.file}`
				);

				return;
			}

			this._push[method].apply(this._push, args);
		} else {
			// No settings for this context - show an error
			vscode.window.showErrorMessage(
				`A settings file could not be found within your project. Have you ` +
				`created a file with the name "${this._push.getConfig('settingsFilename')}" yet?`
			);
		}
	}

	upload(src) {
		this._route('upload', src);
	}

	download(src) {
		this._route('download', src);
	}
}

module.exports = PushCommand;