// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const PushCommand = require('./src/PushCommand');

exports.activate = (context) => {
	var push = new PushCommand();

	context.subscriptions.concat([
		vscode.commands.registerCommand('extension.upload', push.upload),
		vscode.commands.registerCommand('extension.download', push.download),
		vscode.commands.registerCommand('extension.uploadFolder', push.upload),
		vscode.commands.registerCommand('extension.downloadFolder', push.download)
	]);
};

// this method is called when your extension is deactivated
// function deactivate() {
// }
// exports.deactivate = deactivate;