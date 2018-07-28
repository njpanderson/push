/**
 * Copyright 2018 Neil JP Anderson
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const vscode = require('vscode');
const UI = require('./src/UI');

let ui;

exports.activate = (context) => {
	let subscriptions, sub;

	ui = new UI(context);

	subscriptions = {
		'push.upload': 'upload',
		'push.download': 'download',
		'push.uploadFolder': 'upload',
		'push.downloadFolder': 'download',
		'push.diff': 'diff',
		'push.uploadQueuedItems': 'execUploadQueue',
		'push.removeQueuedItem': 'removeUploadQueuedItem',
		'push.clearUploadQueue': 'clearUploadQueue',
		'push.queueGitChangedFiles': 'queueGitChangedFiles',
		'push.uploadGitChangedFiles': 'uploadGitChangedFiles',
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

	vscode.window.registerTreeDataProvider('push.pushExplorer', ui.explorer);
};

// this method is called when your extension is deactivated
// function deactivate() {
// }
// exports.deactivate = deactivate;
