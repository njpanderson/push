const vscode = require('vscode');

const utils = {
	_timeouts: {},
	_sb: null,

	/**
	 * Returns the current config, with any required augmentations made.
	 * @param {string} item - Retrieve a single configuration item
	 */
	getConfig: function(item) {
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
			settingsGlob = `**/${config.settingsFilename}`;
			config.ignoreGlobs.push(settingsGlob);

			// Ensure glob list only contains unique values
			config.ignoreGlobs = utils.uniqArray(config.ignoreGlobs);
		}

		if (item) {
			return config[item] || null;
		}

		return config;
	},

	showMessage: function(message) {
		utils.displayErrorOrString('showInformationMessage', message, [...arguments].slice(1));
	},

	showError: function(message) {
		utils.displayErrorOrString('showErrorMessage', message, [...arguments].slice(1));
	},

	showWarning: function(message) {
		utils.displayErrorOrString('showWarningMessage', message, [...arguments].slice(1));
	},

	/**
	 * Show a status message, optionally removing it after x seconds.
	 * @param {string} message - Message to show
	 * @param {number} [removeAfter=0] - How many seconds to wait before removing the
	 * message. Leave at 0 for a permanent message.
	 * @param {string} [color='green'] - Colour of the message.
	 * @returns vscode.StatusBarItem
	 */
	showStatusMessage: function (message, removeAfter = 0, color = null) {
		this.hideStatusMessage();

		if (!color) {
			color = new vscode.ThemeColor(this.getConfig('statusMessageColor'));
		}

		this._sb = new vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.left
		);

		this._sb.text = message;
		this._sb.color = color;
		this._sb.show();

		if (removeAfter !== 0) {
			if (this._timeouts.sb) {
				clearTimeout(this._timeouts.sb);
			}

			this._timeouts.sb = setTimeout(() => {
				this._sb.hide();
				this._timeouts.sb = null;
			}, (removeAfter * 1000));
		}

		return this._sb;
	},

	/**
	 * Hides any currently active status message.
	 */
	hideStatusMessage: function() {
		if (this._sb) {
			this._sb.hide();
		}
	},

	displayErrorOrString(method, data, replacementVars = []) {
		if (data instanceof Error) {
			vscode.window[method](
				`Push: ${utils.parseTemplate(data.message, replacementVars)}`
			);
		} else {
			vscode.window[method](
				`Push: ${utils.parseTemplate(data, replacementVars)}`
			);
		}
	},

	parseTemplate(data, replacementVars = []) {
		if (replacementVars.length === 0) {
			return data;
		}

		replacementVars.forEach((item, index) => {
			data = data.replace('$' + (index + 1), item);
		});

		return data;
	},

	showFileCollisionPicker(name, callback, queueLength = 0) {
		let options = [
				utils.collisionOpts.skip,
				utils.collisionOpts.rename,
				utils.collisionOpts.stop,
				utils.collisionOpts.overwrite,
			],
			placeHolder = `The file ${name} already exists.`;

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
			placeHolder = `The file ${name} already exists and is of a different type.`;

		return new Promise((resolve) => {
			vscode.window.showQuickPick(
				options,
				{
					placeHolder,
					onDidSelectItem: callback
				}
			).then((option) => {
				resolve({ option, type: 'mismatch_type' });
			})
		});
	},

	/**
	 * Returns an array with only unique values.
	 * @param {array} arrayData - The array to process
	 */
	uniqArray: function(arrayData) {
		return arrayData.filter((e, i, a) => {
			return (a.indexOf(e) === i);
		});
	},

	trimSeparators: function(pathname, separator = '/') {
		const re = new RegExp(`^\${separator}+|\${separator}+$`, 'g');
		return pathname.trim(re, '');
	},

	/**
	 * Adds an OS-specific trailing separator to a path (unless the path
	 * consists solely of a separator).
	 */
	addTrailingSeperator: function (pathname, separator = '/') {
		if (!pathname.endsWith(separator)) {
			return pathname + separator;
		}

		return pathname;
	},

	/**
	 * Adds an OS-specific leading separator to a path (unless the path
	 * consists solely of a separator).
	 */
	addLeadingSeperator: function (pathname, separator = '/') {
		if (!pathname.startsWith(separator)) {
			return pathname + pathname;
		}

		return pathname;
	}
};

utils.collisionOpts = {
	skip: { label: 'Skip', detail: 'Skip uploading the file (default)' },
	stop: { label: 'Stop', detail: 'Stop transfer and empty current queue' },
	overwrite: { label: 'Overwrite', detail: 'Replace the target file with the source file' },
	rename: { label: 'Rename', detail: 'Keep both files by renaming the source file' }
}

utils.collisionOptsAll = {
	skip: {
		label: 'Skip all',
		detail: 'Skip uploading all existing files',
		baseOption: utils.collisionOpts.skip
	},
	overwrite: {
		label: 'Overwrite all',
		detail: 'Replace all existing files',
		baseOption: utils.collisionOpts.overwrite
	},
	rename: {
		label: 'Rename all',
		detail: 'Keep all existing files by renaming the uploaded files',
		baseOption: utils.collisionOpts.rename
	 }
}

utils.errors = {
	stop: new Error('Transfer cancelled')
};

utils.strings = {
	NO_SERVICE_FILE: 'A settings file could not be found within your project. Have you created a file with the name "$1" yet?',
	SERVICE_NOT_DEFINED: 'A transfer service was not defined within the settings file at "$1".',
	MULTIPLE_SERVICE_FILES: 'More than one service settings file was found within the selected directory.',
	TRANSFER_NOT_POSSIBLE: 'The transfer could not be completed.',
	SERVICE_SETTING_MISSING: 'Service setting file for type $1 missing required setting: "$2".',
	CANNOT_ACTION_IGNORED_FILE: 'Cannot $1 file "$2" - It matches one of the defined ignoreGlobs filters.',
	NO_IMPORT_FILE: 'Config file not specified. Please either run this command from within a configuration file or from the explorer context menu.',
	IMPORT_FILE_NOT_SUPPORTED: 'Configuration file format is not supported. Currently, only the Sublime SFTP format is supported.',
	SETTINGS_FILE_EXISTS: 'A settings file already exists in this location. Do you want to overwrite it?',
	REQUESTING_PASSWORD: 'Requesting password... (note, passwords can be saved in the service settings file to avoid this prompt).'
};

module.exports = utils;