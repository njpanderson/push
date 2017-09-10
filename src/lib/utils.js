const vscode = require('vscode');

module.exports = {
	showMessage: (message) => {
		vscode.window.showInformationMessage(`Push: ${message}`);
	},

	showError: (message) => {
		vscode.window.showErrorMessage(`Push: ${message}`);
	},

	showWarning: (message) => {
		vscode.window.showWarningMessage(`Push: ${message}`);
	}
};