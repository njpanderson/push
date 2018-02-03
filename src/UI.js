const vscode = require('vscode');

const Push = require('./Push');
const channel = require('./lib/channel');
const i18n = require('./lang/i18n');

/**
 * Provides a normalised interface for the command panel and contextual menus.
 */
class UI extends Push {
	clearUploadQueue() {
		// TODO: Write
	}

	/**
	 * Show the current upload queue in the console
	 */
	showUploadQueue() {
		this.listQueueItems(Push.queueDefs.upload);
	}

	/**
	 * Uploads a single file or directory by its Uri.
	 * @param {Uri} uri
	 */
	upload(uri) {
		uri = this.paths.getFileSrc(uri);

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
		uri = this.paths.getFileSrc(uri);

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
		let config, tmpFile;

		uri = this.paths.getFileSrc(uri);
		tmpFile = this.paths.getTmpFile();
		config = this.configWithServiceSettings(uri);

		this.service.exec(
			'get',
			config,
			[
				tmpFile,
				this.service.exec(
					'convertUriToRemote',
					config,
					[uri]
				),
				'overwrite'
			]
		).then(() => {
			vscode.commands.executeCommand(
				'vscode.diff',
				tmpFile,
				uri,
				'Diff: ' + this.paths.getBaseName(uri)
			);
		}).catch((error) => {
			channel.appendError(error);
		});
	}

	/**
	 * @description
	 * Watches the files within the supplied Uri path and uploads them whenever
	 * a change is detected
	 * @param {Uri} uri - Folder/File Uri to watch.
	 */
	addWatch(uri) {
		this.watch.add(this.paths.getFileSrc(uri), (uri) => {
			this.upload(uri);
		});
	}

	/**
	 * Removes an existing watch from a Uri.
	 * @param {Uri} uri - Folder/File Uri to stop watching.
	 */
	removeWatch(uri) {
		this.watch.remove(this.paths.getFileSrc(uri));
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
		this.service.editServiceConfig(uri);
	}

	/**
	 * @see Service#importConfig
	 */
	importConfig(uri) {
		this.service.importConfig(uri);
	}
}

module.exports = UI;