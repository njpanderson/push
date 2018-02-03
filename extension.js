// Import the module and reference it with the alias vscode in your code below
// The module 'vscode' contains the VS Code extensibility API
const vscode = require('vscode');
const UI = require('./src/UI');

let ui;

exports.activate = (context) => {
	let subscriptions, sub;

	ui = new UI();

	subscriptions = {
		'push.upload': 'upload',
		'push.download': 'download',
		'push.uploadFolder': 'upload',
		'push.downloadFolder': 'download',
		'push.diff': 'diff',
		'push.uploadQueuedItems': 'execUploadQueue',
		'push.clearUploadQueue': 'clearUploadQueue',
		'push.cancelQueues': 'cancelQueues',
		'push.stopQueues': 'stopQueues',
		'push.addWatchFile': 'addWatch',
		'push.removeWatchFile': 'removeWatch',
		'push.addWatchFolder': 'addWatch',
		'push.removeWatchFolder': 'removeWatch',
		'push.listWatchers': 'listWatchers',
		'push.startWatch': 'startWatch',
		'push.stopWatch': 'stopWatch',
		'push.clearWatchers': 'clearWatchers',
		'push.editServiceConfig': 'editServiceConfig',
		'push.importConfig': 'importConfig'
	};

	for (sub in subscriptions) {
		context.subscriptions.push(
			vscode.commands.registerCommand(sub, ui[subscriptions[sub]], ui)
		);
	}
};

// this method is called when your extension is deactivated
// function deactivate() {
// }
// exports.deactivate = deactivate;