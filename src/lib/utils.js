const vscode = require('vscode');

const config = require('./config');
const tools = require('./tools');
const i18n = require('../lang/i18n');

const utils = {
	_timeouts: {},
	_sb: null,

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
			color = new vscode.ThemeColor(config.get('statusMessageColor'));
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
			placeHolder = i18n.t('filename_exists', name);

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
			})
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
	skip: i18n.o({ label: 'skip', detail: 'skip_uploading_default' }),
	stop: i18n.o({ label: 'stop', detail: 'stop_transfer_empty_queue' }),
	overwrite: i18n.o({ label: 'overwrite', detail: 'replace_target_with_source' }),
	rename: i18n.o({ label: 'rename', detail: 'keep_both_files_by_rename' })
};

utils.collisionOptsAll = {
	skip: i18n.o({
		label: 'skip_all',
		detail: 'skip_uploading_all_existing',
		baseOption: utils.collisionOpts.skip
	}),
	overwrite: i18n.o({
		label: 'overwrite_all',
		detail: 'replace_all_existing',
		baseOption: utils.collisionOpts.overwrite
	}),
	rename: i18n.o({
		label: 'rename_all',
		detail: 'keep_all_existing_by_renaming_uploaded',
		baseOption: utils.collisionOpts.rename
	})
};

utils.errors = {
	stop: new Error(i18n.t('transfer_cancelled'))
};

module.exports = utils;
