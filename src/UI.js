const vscode = require('vscode');

const Push = require('./Push');
const utils = require('./lib/utils');

/**
 * Provides a normalised interface for the command panel and contextual menus.
 */
class UI {
	constructor(context) {
		this.push = new Push(context);
	}

	/**
	 * Show the current upload queue in the console
	 */
	showUploadQueue() {
		this.push.listQueueItems(Push.queueDefs.upload);
	}

	removeUploadQueuedItem(context) {
		let uri;

		if (context instanceof vscode.TreeItem) {
			uri = context.resourceUri;
		} else {
			uri = this.push.paths.getFileSrc(context);
		}

		this.push.removeQueuedUri(Push.queueDefs.upload, uri);
	}

	execUploadQueue() {
		return this.push.execUploadQueue.apply(this.push, arguments);
	}

	clearUploadQueue() {
		if (this.push.clearQueue(Push.queueDefs.upload)) {
			utils.showLocalisedMessage('upload_queue_cleared');
		}
	}

	queueGitChangedFiles() {
		let uri;

		if ((uri = this.push.getValidUri(uri))) {
			return this.push.queueGitChangedFiles(uri).catch(this.push.catchError);
		}
	}

	uploadGitChangedFiles() {
		let uri;

		if ((uri = this.push.getValidUri(uri))) {
			return this.push.queueGitChangedFiles(uri, true).catch(this.push.catchError);
		}
	}

	queueGitCommit() {
		let uri;

		if ((uri = this.push.getValidUri(uri))) {
			return this.push.queueGitCommitChanges(uri).catch(this.push.catchError);
		}
	}

	uploadGitCommit() {
		let uri;

		if ((uri = this.push.getValidUri(uri))) {
			return this.push.queueGitCommitChanges(uri, true).catch(this.push.catchError);
		}
	}

	/**
	 * Uploads a selection of files or directories by their Uris.
	 * @param {Uri} uri
	 */
	upload(uri, uriList) {
		return this.push
			.transfer(this.push.getValidUri(uriList, uri), 'put')
			.catch(this.push.catchError);
	}

	/**
	 * Downloads a selection of files or directories by their Uris.
	 * @param {Uri} uri
	 */
	download(uri, uriList) {
		return this.push
			.transfer(this.push.getValidUri(uriList, uri), 'get')
			.catch(this.push.catchError);
	}

	/**
	 * @description
	 * Discover differences between the local and remote file. Uses the contextual
	 * service to retrieve the remote URI and vscode to diff the files.
	 * @param {Uri} uri
	 */
	diff(uri) {
		if ((uri = this.push.getValidUri(uri))) {
			return this.push.diffRemote(uri).catch(this.push.catchError);
		}
	}

	/**
	 * @description
	 * Watches the files within the supplied Uri path and uploads them whenever
	 * a change is detected
	 * @param {Uri} uri - Folder/File Uri to watch.
	 */
	addWatch(uri) {
		if (!(uri = this.push.getValidUri(uri))) {
			return false;
		}

		return this.push.watch.add(uri).catch(this.push.catchError);
	}

	/**
	 * Removes an existing watch from a Uri.
	 * @param {Uri|TreeItem} uri - Folder/File Uri or TreeItem to stop watching.
	 */
	removeWatch(context) {
		let uri;

		if (context instanceof vscode.TreeItem) {
			context = context.resourceUri;
		}

		if ((uri = this.push.paths.getFileSrc(context))) {
			this.push.watch.remove(uri).catch(this.push.catchError);
		}
	}

	/**
	 * Lists active watchers
	 */
	listWatchers() {
		this.push.watch.list();
	}

	/**
	 * Starts the internal watch process and watches the blobs.
	 */
	startWatch() {
		this.push.watch.toggle(true);
	}

	/**
	 * Stops the internal watch process.
	 */
	stopWatch() {
		this.push.watch.toggle(false);
	}

	/**
	 * Clear all (active or disabled) watchers
	 */
	clearWatchers() {
		this.push.watch.clear();
	}

	/**
	 * Purges all stored watchers within the contextual storage
	 */
	purgeStoredWatchers() {
		this.push.watch.purge();
	}

	cancelQueues() {
		this.push.stopCancellableQueues();
	}

	stopQueues() {
		this.push.stopCancellableQueues(true);
	}

	/**
	 * @see Service#createServiceConfig
	 */
	createServiceConfig(uri) {
		if ((uri = this.push.getValidUri(uri))) {
			return this.push.service.settings
				.editServiceConfig(uri, true)
				.catch(this.push.catchError);
		} else {
			utils.showLocalisedWarning('no_servicefile_context');
		}
	}

	/**
	 * @see Service#editServiceConfig
	 */
	editServiceConfig(uri) {
		if ((uri = this.push.getValidUri(uri))) {
			return this.push.service.settings
				.editServiceConfig(uri)
				.catch(this.push.catchError);
		} else {
			utils.showLocalisedWarning('no_servicefile_context');
		}
	}

	/**
	 * @description
	 * Sets the current service file environment, then disables any active watchers,
	 * depending on the user's preference.
	 * @see Service#setConfigEnv
	 */
	setServiceEnv(uri) {
		if ((uri = this.push.getValidUri(uri))) {
			return this.push.service
				.setConfigEnv(uri)
				.then(() => {
					if (this.push.config.disableWatchOnEnvChange) {
						this.stopWatch();
					}
				})
				.catch(this.push.catchError);
		} else {
			utils.showLocalisedWarning('no_servicefile_context');
		}
	}

	/**
	 * @see Service#importConfig
	 */
	importConfig(uri) {
		if (this.push.getValidUri(uri)) {
			return this.push.service.settings.importConfig(uri).catch(this.push.catchError);
		}
	}
}

module.exports = UI;
