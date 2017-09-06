// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const PushCommand = require('./src/PushCommand');

exports.activate = (context) => {
	var cmd = new PushCommand();

	context.subscriptions.concat([
		vscode.commands.registerCommand('extension.upload', cmd.upload),
		vscode.commands.registerCommand('extension.download', cmd.download),
		vscode.commands.registerCommand('extension.uploadFolder', cmd.upload),
		vscode.commands.registerCommand('extension.downloadFolder', cmd.download)
	]);
};

// this method is called when your extension is deactivated
// function deactivate() {
// }
// exports.deactivate = deactivate;