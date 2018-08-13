const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const ServiceBase = require('./Base');
const utils = require('../lib/utils');
const ExtendedStream = require('../lib/ExtendedStream');
const PathCache = require('../lib/PathCache');
const i18n = require('../lang/i18n');
const { TRANSFER_TYPES } = require('../lib/constants');

const SRC_REMOTE = PathCache.sources.REMOTE;
const SRC_LOCAL = PathCache.sources.LOCAL;

/**
 * Filesystem based uploading.
 */
class File extends ServiceBase {
	constructor(options, defaults) {
		super(options, defaults);

		this.mkDir = this.mkDir.bind(this);

		this.type = 'File';
		this.pathCache = new PathCache();
		this.writeStream = null;
		this.readStream = null;

		// Define File validation rules
		this.serviceValidation = {
			root: true
		};
	}

	init(queueLength) {
		return super.init(queueLength)
			.then(() => {
				return this.pathCache.clear();
			});
	}

	/**
	 * Put a single file to the remote location.
	 * @param {uri} local - Local Uri or Readable stream instance.
	 * @param {uri} remote - Remote Uri.
	 */
	put(local, remote) {
		// Perform transfer from local to remote, setting root as defined by service
		return this.transfer(
			TRANSFER_TYPES.PUT,
			local,
			vscode.Uri.file(remote),
			vscode.Uri.file(this.config.service.root),
			this.config.service.collisionUploadAction
		);
	}

	/**
	 * Get a single file from the remote location.
	 * @param {uri} local - Local Uri.
	 * @param {uri} remote - Remote Uri.
	 * @param {string} [collisionAction] - What to do on file collision. Use one
	 * of the utils.collisionOpts collision actions.
	 */
	get(local, remote, collisionAction) {
		collisionAction = collisionAction ||
			this.config.service.collisionDownloadAction;

		// Perform transfer from remote to local, setting root as base of service file
		return this.transfer(
			TRANSFER_TYPES.GET,
			vscode.Uri.file(remote),
			local,
			vscode.Uri.file(path.dirname(this.config.serviceFilename)),
			collisionAction
		);
	}

	/**
	 * Transfers a single file from location to another.
	 * @param {number} transferType - One of the {@link TRANSFER_TYPES} types.
	 * @param {Uri} src - Source Uri.
	 * @param {Uri} dest - Destination Uri.
	 * @param {Uri} root - Root directory. Used for validation.
	 */
	transfer(transferType, src, dest, root, collisionAction) {
		let destPath = this.paths.getNormalPath(dest),
			destDir = path.dirname(destPath),
			destFilename = path.basename(destPath),
			rootDir = this.paths.getNormalPath(root),
			logPrefix = (transferType === TRANSFER_TYPES.PUT ? '>> ' : '<< '),
			srcType = (transferType === TRANSFER_TYPES.PUT ? SRC_REMOTE : SRC_LOCAL);

		this.setProgress(`${destFilename}...`);

		return this.mkDirRecursive(destDir, rootDir, this.mkDir, ServiceBase.pathSep)
			.then(() => this.getFileStats(
				(transferType === TRANSFER_TYPES.PUT) ? src : dest,
				(transferType === TRANSFER_TYPES.PUT) ? dest : src,
			))
			.then((stats) => super.checkCollision(
				(transferType === TRANSFER_TYPES.PUT) ? stats.local : stats.remote,
				(transferType === TRANSFER_TYPES.PUT) ? stats.remote : stats.local,
				collisionAction
			))
			.then((result) => {
				// Figure out what to do based on the collision (if any)
				if (result === false) {
					// No collision, just keep going
					this.channel.appendLine(`${logPrefix}${destPath}`);
					return this.copy(src, destPath);
				} else {
					this.setCollisionOption(result);

					switch (result.option) {
						case utils.collisionOpts.stop:
							throw utils.errors.stop;

						case utils.collisionOpts.skip:
							return false;

						case utils.collisionOpts.overwrite:
							this.channel.appendLine(`${logPrefix}${destPath}`);
							return this.copy(src, destPath);

						case utils.collisionOpts.rename:
							return this.list(destDir, srcType)
								.then((dirContents) => {
									// Re-invoke transfer with new filename
									destPath = destDir + '/' + this.getNonCollidingName(
										destFilename,
										dirContents
									);

									return this.transfer(
										src,
										destPath,
										rootDir,
										logPrefix
									);
								});
					}

					return false;
				}
			})
			.then((result) => {
				this.setProgress(false);
				return result;
			})
			.catch((error) => {
				this.setProgress(false);
				throw error;
			});
	}

	/**
	 * Effectively stops the read and write streams by end() and destroy().
	 */
	stop() {
		return new Promise((resolve) => {
			// Stop read stream
			if (this.readStream) {
				this.readStream.destroy();
			}

			// Stop write stream
			if (this.writeStream) {
				this.writeStream.end();
				this.writeStream.destroy();
			}

			resolve();
		});
	}

	/**
	 * Recursively creates directories up to and including the basename of the given path.
	 * Will reject on an incompatible collision.
	 * @param {string} dest - Destination directory to create
	 */
	mkDir(dir) {
		return this.list(path.dirname(dir))
			.then(() => {
				let existing = this.pathCache.getFileByPath(SRC_REMOTE, dir);

				if (existing === null) {
					return new Promise((resolve, reject) => {
						fs.mkdir(dir, (error) => {
							if (error) {
								reject(error);
							}

							// Add dir to cache
							this.pathCache.addCachedFile(
								SRC_REMOTE,
								dir,
								((new Date()).getTime() / 1000),
								'd'
							);

							resolve();
						});
					});
				} else if (existing.type === 'f') {
					return Promise.reject(new Error(
						i18n.t('directory_not_created_remote_mismatch', dir)
					));
				}
			});
	}

	/**
	 * Return a list of the remote directory.
	 * @param {string} dir - Remote directory to list
	 * @param {string} loc - One of the {@link PathCache.sources} types.
	 */
	list(dir, loc = SRC_REMOTE) {
		return this.paths.listDirectory(dir, loc, this.pathCache);
	}

	/**
	 * @param {string} dir - Directory to list.
	 * @param {string} ignoreGlobs - List of globs to ignore.
	 * @description
	 * Returns a promise either resolving to a recursive file list in the format
	 * given by {@link PathCache#getRecursiveFiles}, or rejects if `dir` is not
	 * found.
	 * @returns {promise}
	 */
	listRecursiveFiles(dir, ignoreGlobs) {
		return this.paths.getDirectoryContentsAsFiles(
			vscode.Uri.file(dir),
			ignoreGlobs
		);
	}

	/**
	 * Obtains local/remote stats for a file.
	 * @param {uri} local - Local Uri.
	 * @param {uri} remote - Remote Uri.
	 */
	getFileStats(local, remote) {
		const remotePath = this.paths.getNormalPath(remote),
			remoteDir = path.dirname(remotePath);

		return this.list(remoteDir, SRC_REMOTE)
			.then(() => ({
				// Get remote stats
				remote: this.pathCache.getFileByPath(SRC_REMOTE, remotePath)
			}))
			.then(stats => (new Promise(resolve => {
				// Get local stats
				this.paths.getFileStats(this.paths.getNormalPath(local))
					.then(local => {
						resolve(Object.assign(stats, {
							local
						}));
					});
			})));
	}

	/**
	 * Copies a file or stream from one location to another.
	 * @param {*} src - Either a source Uri or a readable stream.
	 * @param {string} dest - Destination filename.
	 */
	copy(src, dest) {
		return new Promise((resolve, reject) => {
			function fnError(error) {
				this.stop(() => reject(error));
			};

			// Create write stream & attach events
			this.writeStream = fs.createWriteStream(dest);
			this.writeStream.on('error', fnError.bind(this));
			this.writeStream.on('finish', resolve);

			if (src instanceof vscode.Uri || typeof src === 'string') {
				// Source is a VSCode Uri - create a read stream
				this.readStream = fs.createReadStream(this.paths.getNormalPath(src));
				this.readStream.on('error', fnError.bind(this));
				this.readStream.pipe(this.writeStream);
			} else if (src instanceof ExtendedStream) {
				// Source is already a stream - just pipe to the write stream
				this.readStream = src.read;
				this.readStream.on('error', fnError.bind(this));
				this.readStream.pipe(this.writeStream);
			} else {
				reject(new Error(
					'Source src argument is neither a readable stream or a filename.'
				));
			}
		});
	}
};

File.description = i18n.t('file_class_description');

File.defaults = {
	root: '/'
};

module.exports = File;
