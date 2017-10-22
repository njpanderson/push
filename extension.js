// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const Push = require('./src/Push');

let push;

exports.activate = (context) => {
	push = new Push();

	context.subscriptions.concat([
		vscode.commands.registerCommand('push.upload', push.upload),
		vscode.commands.registerCommand('push.download', push.download),
		vscode.commands.registerCommand('push.uploadFolder', push.upload),
		vscode.commands.registerCommand('push.downloadFolder', push.download),
		vscode.commands.registerCommand('push.uploadQueuedItems', push.execUploadQueue),
		vscode.commands.registerCommand('push.clearUploadQueue', push.clearUploadQueue),
		vscode.commands.registerCommand('push.cancelQueues', push.cancelQueues),
		vscode.commands.registerCommand('push.stopQueues', push.stopQueues)
	]);
};

// this method is called when your extension is deactivated
// function deactivate() {
// }
// exports.deactivate = deactivate;