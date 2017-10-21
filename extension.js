// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const Push = require('./src/Push');

let push;

exports.activate = (context) => {
	push = new Push();

	context.subscriptions.concat([
		vscode.commands.registerCommand('extension.upload', push.upload),
		vscode.commands.registerCommand('extension.download', push.download),
		vscode.commands.registerCommand('extension.uploadFolder', push.upload),
		vscode.commands.registerCommand('extension.downloadFolder', push.download),
		vscode.commands.registerCommand('extension.uploadQueuedItems', push.execUploadQueue),
		vscode.commands.registerCommand('extension.clearUploadQueue', push.clearUploadQueue),
		vscode.commands.registerCommand('extension.cancelQueues', push.cancelQueues),
		vscode.commands.registerCommand('extension.stopQueues', push.stopQueues)
	]);
};

// this method is called when your extension is deactivated
// function deactivate() {
// }
// exports.deactivate = deactivate;