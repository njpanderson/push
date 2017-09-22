const vscode = require('vscode');

const utils = {
	showMessage: (message) => {
		utils.displayErrorOrString('showInformationMessage', message);
	},

	showError: (message) => {
		utils.displayErrorOrString('showErrorMessage', message);
	},

	showWarning: (message) => {
		utils.displayErrorOrString('showWarningMessage', message);
	},

	displayErrorOrString(method, data) {
		if (data instanceof Error) {
			vscode.window[method](`Push: ${data.message}`);
		} else {
			vscode.window[method](`Push: ${data}`);
		}
	},

	showFileCollisionPicker(name, mismatchedTypes = false, callback) {
		let options = [
				utils.collisionOpts.skip,
				utils.collisionOpts.rename,
				utils.collisionOpts.stop
			],
			placeHolder = `The file ${name} already exists.`;

		if (!mismatchedTypes) {
			options.push(utils.collisionOpts.overwrite);
		} else {
			placeHolder = `The file ${name} already exists and is of a different type.`
		}

		return vscode.window.showQuickPick(
			options,
			{
				placeHolder,
				onDidSelectItem: callback
			}
		)
	},

	/**
	 * Returns an array with only unique values.
	 * @param {array} arrayData - The array to process
	 */
	uniqArray: function(arrayData) {
		return arrayData.filter((e, i, a) => {
			return (a.indexOf(e) === i);
		});
	}
};

utils.collisionOpts = {
	skip: { label: 'Skip', detail: 'Skip uploading the file (default)' },
	stop: { label: 'Stop', detail: 'Stop transfer and empty current queue' },
	overwrite: { label: 'Overwrite', detail: 'Replace the target file with the source file' },
	rename: { label: 'Rename', detail: 'Keep both files by renaming the source file' }
}

utils.errors = {
	stop: new Error('Transfer cancelled')
};

module.exports = utils;