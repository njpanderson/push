const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const ServiceBase = require('./Base');
const TransferResult = require('./TransferResult');
const utils = require('../lib/utils');
const ExtendedStream = require('../lib/ExtendedStream');
const PathCache = require('../lib/pathcache/Index');
const PushError = require('../lib/PushError');
const i18n = require('../lang/i18n');
const { TRANSFER_TYPES } = require('../lib/constants');

const SRC_REMOTE = PathCache.sources.REMOTE;
const SRC_LOCAL = PathCache.sources.LOCAL;

/**
 * Filesystem based uploading.
 */
class File extends ServiceBase {
	constructor(options, defaults, required) {
		super(options, defaults, required);

		this.mkDir = this.mkDir.bind(this);
		this.checkServiceRoot = this.checkServiceRoot.bind(this);

		this.type = 'File';
		this.pathCache = new PathCache();
		this.writeStream = null;
		this.readStream = null;
	}

	init(queueLength) {
		return super.init(queueLength)
			.then(this.checkServiceRoot)
			.then(() => {
				return this.pathCache.clear();
			});
	}

	/**
	 * Attempt to list the root path to ensure it exists
	 * @param {SFTP} client - SFTP client object.
	 * @param {function} resolve - Promise resolver function.
	 */
	checkServiceRoot() {
		if (fs.existsSync(this.config.service.root)) {
			return true;
		}

		throw new PushError(
			i18n.t('service_missing_root', this.config.settingsFilename)
		);
	}

	/**
	 * Put a single file to the remote location.
	 * @param {Uri} local - Local Uri or Readable stream instance.
	 * @param {string} remote - Remote path.
	 */
	put(local, remote) {
		utils.assertFnArgs('File#put', arguments, [vscode.Uri, 'string']);

		if (!this.paths.fileExists(local)) {
			// Local file doesn't exist. Immediately resolve with failing TransferResult
			return Promise.resolve(new TransferResult(
				local,
				new PushError(i18n.t('file_not_found', this.paths.getBaseName(local))),
				TRANSFER_TYPES.PUT
			));
		}

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
	 * @param {Uri} local - Local Uri.
	 * @param {string} remote - Remote path.
	 * @param {string} [collisionAction] - What to do on file collision. Use one
	 * of the utils.collisionOpts collision actions.
	 */
	get(local, remote, collisionAction) {
		utils.assertFnArgs('File#get', arguments, [vscode.Uri, 'string']);

		// Convert remote into a Uri
		remote = vscode.Uri.file(remote);

		collisionAction = collisionAction ||
			this.config.service.collisionDownloadAction;

		if (!this.paths.fileExists(remote)) {
			// Remote file doesn't exist. Immediately resolve with failing TransferResult
			return Promise.resolve(new TransferResult(
				remote,
				new PushError(i18n.t('file_not_found', this.paths.getBaseName(remote))),
				TRANSFER_TYPES.PUT
			));
		}

		// Perform transfer from remote to local, setting root as base of service file
		return this.transfer(
			TRANSFER_TYPES.GET,
			remote,
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
			srcType = (transferType === TRANSFER_TYPES.PUT ? SRC_REMOTE : SRC_LOCAL);

		this.setProgress(`${destFilename}...`);

		return this.mkDirRecursive(destDir, rootDir, this.mkDir, ServiceBase.pathSep)
			.then(() => this.getFileStats(
				(transferType === TRANSFER_TYPES.PUT ? src : dest),
				(transferType === TRANSFER_TYPES.PUT ? dest : src)
			))
			.then((stats) => {
				return super.checkCollision(
					(transferType === TRANSFER_TYPES.PUT) ? stats.local : stats.remote,
					(transferType === TRANSFER_TYPES.PUT) ? stats.remote : stats.local,
					collisionAction
				);
			})
			.then((collision) => {
				// Figure out what to do based on the collision (if any)
				if (collision === false) {
					// No collision, just keep going
					return this.copy(src, destPath, transferType);
				} else {
					this.setCollisionOption(collision);

					switch (collision.option) {
					case utils.collisionOpts.stop:
						throw utils.errors.stop;

					case utils.collisionOpts.skip:
						return new TransferResult(src, false, transferType, {
							srcLabel: destPath
						});

					case utils.collisionOpts.overwrite:
						return this.copy(src, destPath, transferType);

					case utils.collisionOpts.rename:
						return this.list(destDir, srcType)
							.then((dirContents) => {
								// Re-invoke transfer with new filename
								destPath = destDir + '/' + this.getNonCollidingName(
									destFilename,
									dirContents
								);

								return this.transfer(
									transferType,
									src,
									destPath,
									rootDir
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
							this.pathCache.addFilePath(
								SRC_REMOTE,
								dir,
								((new Date()).getTime() / 1000),
								'd'
							);

							resolve();
						});
					});
				} else if (existing.type === 'f') {
					return Promise.reject(new PushError(
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
	 * @returns {Promise<array>} Resolving to an array of files.
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
	 * @param {number} transferType - One of the TRANSFER_TYPES types.
	 */
	copy(src, dest, transferType) {
		return new Promise((resolve, reject) => {
			function fnError(error) {
				this.stop(() => reject(error));
			};

			// Create write stream & attach events
			this.writeStream = fs.createWriteStream(dest);

			this.writeStream.on('error', fnError.bind(this));

			this.writeStream.on('finish', () => {
				resolve(new TransferResult(
					src,
					true,
					transferType, {
						srcLabel: dest
					}
				));
			});

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

File.required = {
	root: true
};

module.exports = File;
