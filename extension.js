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

/**
 * Visual Studio Code API - Uri class.
 * @typedef {object} Uri
 * @see https://code.visualstudio.com/docs/extensionAPI/vscode-api#Uri
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
		'push.queueGitCommit': 'queueGitCommit',
		'push.uploadGitCommit': 'uploadGitCommit',
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
		'push.purgeStoredWatchers': 'purgeStoredWatchers',
		'push.editServiceConfig': 'editServiceConfig',
		'push.createServiceConfig': 'createServiceConfig',
		'push.setServiceEnv': 'setServiceEnv',
		'push.importConfig': 'importConfig'
	};

	for (sub in subscriptions) {
		context.subscriptions.push(
			vscode.commands.registerCommand(sub, ui[subscriptions[sub]], ui)
		);
	}

	vscode.window.registerTreeDataProvider(
		'push.watchListExplorer',
		ui.push.explorers.watchList
	);

	vscode.window.registerTreeDataProvider(
		'push.uploadQueueExplorer',
		ui.push.explorers.uploadQueue
	);
};

// this method is called when your extension is deactivated
// function deactivate() {
// }
// exports.deactivate = deactivate;
