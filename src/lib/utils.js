const vscode = require('vscode');

const utils = {
	showMessage: function(message) {
		utils.displayErrorOrString('showInformationMessage', message, [...arguments].slice(1));
	},

	showError: function(message) {
		utils.displayErrorOrString('showErrorMessage', message, [...arguments].slice(1));
	},

	showWarning: function(message) {
		utils.displayErrorOrString('showWarningMessage', message, [...arguments].slice(1));
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

utils.strings = {
	NO_SERVICE_FILE: 'A settings file could not be found within your project. Have you ' +
		'created a file with the name $1 yet?'
}

module.exports = utils;