const vscode = require('vscode');

const Push = require('./Push');
const utils = require('./lib/utils');

/**
 * Provides a normalised interface for the command panel and contextual menus.
 */
class UI extends Push {
	clearUploadQueue() {
		if (super.clearQueue(Push.queueDefs.upload)) {
			utils.showLocalisedMessage('upload_queue_cleared');
		}
	}

	/**
	 * Show the current upload queue in the console
	 */
	showUploadQueue() {
		this.listQueueItems(Push.queueDefs.upload);
	}

	removeUploadQueuedItem(context) {
		let uri;

		if (context instanceof vscode.TreeItem) {
			uri = context.resourceUri;
		} else {
			uri = this.paths.getFileSrc(context);
		}

		super.removeQueuedItem(Push.queueDefs.upload, uri);
	}

	queueGitChangedFiles() {
		let uri;

		if ((uri = this.getValidUri(uri))) {
			super.queueGitChangedFiles(uri);
		}
	}

	uploadGitChangedFiles() {
		let uri;

		if ((uri = this.getValidUri(uri))) {
			super.queueGitChangedFiles(uri, true);
		}
	}

	/**
	 * Uploads a single file or directory by its Uri.
	 * @param {Uri} uri
	 */
	upload(uri) {
		if (!(uri = this.getValidUri(uri))) {
			return false;
		}

		if (this.paths.isDirectory(uri)) {
			return this.ensureSingleService(uri)
				.then(() => {
					return this.transferDirectory(uri, 'put');
				});
		}

		return this.transfer(uri, 'put');
	}

	/**
	 * Downloads a single file or directory by its Uri.
	 * @param {Uri} uri
	 */
	download(uri) {
		if (!(uri = this.getValidUri(uri))) {
			return false;
		}

		if (this.paths.isDirectory(uri)) {
			return this.ensureSingleService(uri)
				.then(() => {
					return this.transferDirectory(uri, 'get');
				});
		}

		return this.transfer(uri, 'get');
	}

	/**
	 * @description
	 * Discover differences between the local and remote file. Uses the contextual
	 * service to retrieve the remote URI and vscode to diff the files.
	 * @param {Uri} uri
	 */
	diff(uri) {
		if ((uri = this.getValidUri(uri))) {
			this.diffRemote(uri);
		}
	}

	/**
	 * @description
	 * Watches the files within the supplied Uri path and uploads them whenever
	 * a change is detected
	 * @param {Uri} uri - Folder/File Uri to watch.
	 */
	addWatch(uri) {
		if (!(uri = this.getValidUri(uri))) {
			return false;
		}

		this.watch.add(uri, (uri) => {
			if (this.config.queueWatchedFiles) {
				this.queueForUpload(uri);
			} else {
				this.upload(uri);
			}
		});
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

		if ((uri = this.paths.getFileSrc(context))) {
			this.watch.remove(uri);
		}
	}

	/**
	 * Lists active watchers
	 */
	listWatchers() {
		this.watch.list();
	}

	/**
	 * Starts the internal watch process and watches the blobs.
	 */
	startWatch() {
		this.watch.toggle(true);
	}

	/**
	 * Stops the internal watch process.
	 */
	stopWatch() {
		this.watch.toggle(false);
	}

	/**
	 * Clear all (active or disabled) watchers
	 */
	clearWatchers() {
		this.watch.clear();
	}

	cancelQueues() {
		this.stopCancellableQueues();
	}

	stopQueues() {
		this.stopCancellableQueues(true);
	}

	/**
	 * @see Service#editServiceConfig
	 */
	editServiceConfig(uri) {
		if (this.getValidUri(uri)) {
			this.service.editServiceConfig(uri);
		}
	}

	/**
	 * @see Service#importConfig
	 */
	importConfig(uri) {
		if (this.getValidUri(uri)) {
			this.service.importConfig(uri);
		}
	}
}

module.exports = UI;
