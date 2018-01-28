const vscode = require('vscode');

const Push = require('./Push');
const utils = require('./lib/utils');
const channel = require('./lib/channel');
const constants = require('./lib/constants');

/**
 * Provides a normalised interface for the command panel and contextual menus.
 */
class UI extends Push {
	clearUploadQueue() {
		// TODO: Write
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
	 * Discover differences between the local and remote file.
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

	/**
	 * Edits (or creates) a server configuration file
	 * @param {Uri} uri - Uri to start looking for a configuration file
	 */
	editServiceConfig(uri) {
		let rootPaths, dirName, settingsFile;

		uri = this.paths.getFileSrc(uri);
		dirName = this.paths.getDirName(uri, true);

		// Find the nearest settings file
		settingsFile = this.paths.findFileInAncestors(
			this.config.settingsFilename,
			dirName
		);

		if (dirName !== ".") {
			// If a directory is defined, use it as the root path
			rootPaths = [{
				uri: vscode.Uri.file(dirName)
			}]
		} else {
			rootPaths = this.paths.getWorkspaceRootPaths();
		}

		if (settingsFile) {
			// Edit the settings file found
			this.openDoc(settingsFile);
		} else {
			// Produce a prompt to create a new settings file
			this.getFileNamePrompt(this.config.settingsFilename, rootPaths)
				.then((file) => {
					if (file.exists) {
						this.openDoc(file.fileName);
					} else {
						this.writeAndOpen(
							constants.DEFAULT_SERVICE_CONFIG,
							file.fileName
						);
					}
				});
		}
	}

	/**
	 * Imports a configuration file from Sublime SFTP
	 * @param {Uri} uri - Uri to start looking for a configuration file
	 * @param {string} type - Type of config to import. Currently only 'SSFTP'
	 * is supported.
	 */
	importConfig(uri) {
		let className, pathName, basename, instance, settings;

		pathName = this.paths.getNormalPath(this.paths.getFileSrc(uri));

		if (!(basename = this.paths.getBaseName(pathName))) {
			channel.appendError(utils.strings.NO_IMPORT_FILE);
		}

		// Figure out which config type this is and import
		for (className in constants.CONFIG_FORMATS) {
			if (constants.CONFIG_FORMATS[className].test(basename)) {
				className = require(`./lib/importers/${className}`);
				instance = new className();

				return instance.import(pathName)
					.then((result) => {
						settings = result;

						return this.getFileNamePrompt(
							this.config.settingsFilename,
							this.paths.getDirName(pathName),
							true
						);
					})
					.then((result) => {
						if (result.exists) {
							// Settings file already exists at this location!
							return vscode.window.showInformationMessage(
								utils.strings.SETTINGS_FILE_EXISTS,
								{
									title: 'Overwrite'
								}, {
									isCloseAffordance: true,
									title: 'Cancel'
								}
							).then((collisionAnswer) => ({
								fileName: result.fileName,
								write: (collisionAnswer.title === 'Overwrite')
							}));
						} else {
							// Just create and open
							return ({ fileName: result.fileName, write: true });
						}
					})
					.then((result) => {
						if (result.write) {
							// Write the file
							this.writeAndOpen(
								`\/\/ Settings imported from ${pathName}\n` +
								JSON.stringify(settings, null, '\t'),
								result.fileName
							);
						}
					})
					.catch((error) => {
						channel.appendError(error);
					});
			}
		}

		channel.appendError(utils.strings.IMPORT_FILE_NOT_SUPPORTED);
	}
}

module.exports = UI;