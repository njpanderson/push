const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const ServiceBase = require('./Base');
const utils = require('../lib/utils');
const ExtendedStream = require('../lib/ExtendedStream');
const PathCache = require('../lib/PathCache');

const SRC_REMOTE = PathCache.sources.REMOTE;

class File extends ServiceBase {
	constructor() {
		super();

		this.mkDir = this.mkDir.bind(this);

		this.type = 'File';
		this.pathCache = new PathCache();

		// Define File defaults
		this.serviceDefaults = {
			root: '/',
			timeZoneOffset: 0,
			testCollisionTimeDiffs: true
		};

		// Define File validation rules
		this.serviceValidation = {
			root: true
		};
	}

	destructor() {
		return new Promise((resolve) => {
			Object.keys(this.clients).forEach((hash) => {
				this.removeClient(hash);
			});

			resolve();
		});
	}

	init() {
		return this.pathCache.clear();
	}

	/**
	 * Put a single file to the remote location.
	 * @param {uri} local - Local Uri or Readable stream instance.
	 * @param {uri} remote - Remote Uri.
	 */
	put(local, remote) {
		// Perform transfer from local to remote, setting root as defined by service
		return this.transfer(
			local,
			vscode.Uri.parse(remote),
			this.config.service.root
		);
	}

	/**
	 * Put a single file to the remote location.
	 * @param {uri} local - Local Uri.
	 * @param {uri} remote - Remote Uri.
	 */
	get(local, remote) {
		// Perform transfer from remote to local, setting root as base of service file
		return this.transfer(
			vscode.Uri.parse(remote),
			local,
			path.dirname(this.config.serviceFilename)
		);
	}

	/**
	 * Transfers a single file from location to another.
	 * @param {uri} src - Source Uri.
	 * @param {uri} dest - Destination Uri.
	 * @param {string} rootDir - Root directory. Used for validation.
	 */
	transfer(src, dest, rootDir) {
		let destPath = this.paths.getNormalPath(dest),
			destDir = path.dirname(destPath),
			destFilename = path.basename(destPath);

		this.setProgress(`${destFilename}...`);

		return this.mkDirRecursive(destDir, rootDir, this.mkDir)
			.then(() => {
				return this.getFileStats(dest, src);
			})
			.then((stats) => {
				return super.checkCollision(stats.local, stats.remote);
			})
			.then((result) => {
				// Figure out what to do based on the collision (if any)
				if (result === false) {
					// No collision, just keep going
					this.channel.appendLine(`>> ${destPath}`);
					return this.copy(src, destPath);
				} else {
					this.setCollisionOption(result);

					switch (result.option) {
						case utils.collisionOpts.stop:
							throw utils.errors.stop;

						case utils.collisionOpts.skip:
							return false;

						case utils.collisionOpts.overwrite:
							this.channel.appendLine(`>> ${destPath}`);
							return this.copy(src, destPath);

						case utils.collisionOpts.rename:
							return this.list(destDir)
								.then((dirContents) => {
									destPath = destDir + '/' + this.getNonCollidingName(
											destFilename,
											dirContents
										);

									this.channel.appendLine(`>> ${destPath}`);

									return this.put(
										src,
										destPath
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
	 * Recursively creates direcotories up to and including the basename of the given path.
	 * Will reject on an incompatible collision.
	 * @param {string} dest - Destination directory to create
	 */
	mkDir(dest) {
		return this.list(path.dirname(dest))
			.then(() => {
				let existing = this.pathCache.getFileByPath(SRC_REMOTE, dest);

				if (existing === null) {
					return new Promise((resolve, reject) => {
						fs.mkdir(dest, (error) => {
							if (error) {
								reject(error);
							}

							// Add dir to cache
							this.pathCache.addCachedFile(
								SRC_REMOTE,
								dest,
								((new Date()).getTime() / 1000),
								'd'
							);

							resolve();
						});
					});
				} else if (existing.type === 'f') {
					return Promise.reject(new Error(
						'Directory could not be created' +
						' (a file with the same name exists on the remote!)'
					));
				}
			});
	}

	/**
	 * Return a list of the remote directory.
	 * @param {string} dir - Remote directory to list
	 */
	list(dir) {
		if (this.pathCache.dirIsCached(SRC_REMOTE, dir)) {
			return Promise.resolve(this.pathCache.getDir(SRC_REMOTE, dir));
		} else {
			return new Promise((resolve, reject) => {
				fs.readdir(dir, (error, list) => {
					if (error) {
						return reject(error);
					}

					list.forEach((filename) => {
						let pathname = dir + '/' + filename,
							stats = fs.statSync(pathname);

						this.pathCache.addCachedFile(
							SRC_REMOTE,
							pathname,
							(stats.mtime.getTime() / 1000),
							(stats.isDirectory() ? 'd' : 'f')
						);
					});

					resolve(this.pathCache.getDir(SRC_REMOTE, dir));
				});
			});
		}
	}

	/**
	 * Obtains local/remote stats for a file.
	 * @param {string} remote - Remote pathname.
	 * @param {uri|stream} local - Local Uri.
	 */
	getFileStats(remote, local) {
		const remotePath = this.paths.getNormalPath(remote),
			remoteDir = path.dirname(remotePath);

		return this.list(remoteDir)
			.then(() => {
				const remoteStat = this.pathCache.getFileByPath(
					SRC_REMOTE,
					remotePath
				);

				let localPath = this.paths.getNormalPath(local),
					localStat = fs.statSync(localPath);

				return {
					local: {
						name: path.basename(localPath),
						modified: (localStat.mtime.getTime() / 1000),
						type: (localStat.isDirectory() ? 'd' : 'f')
					},
					remote: remoteStat
				};
			});
	}

	/**
	 * Copies a file or stream from one location to another.
	 * @param {*} src - Either a source Uri or a readable stream.
	 * @param {string} dest - Destination filename.
	 */
	copy(src, dest) {
		return new Promise((resolve, reject) => {
			let read, write;

			function cleanUp() {
				read.destroy();
				write.end();
				reject();
			}

			// Create write stream
			write = fs.createWriteStream(dest);
			write.on('error', cleanUp);

			write.on('finish', resolve);

			if (src instanceof vscode.Uri || typeof src === 'string') {
				// Source is a VSCode Uri - create a read stream
				read = fs.createReadStream(this.paths.getNormalPath(src));
				read.on('error', cleanUp);
				read.pipe(write);
			} else if (src instanceof ExtendedStream) {
				// Source is already a stream - just pipe to the write stream
				src.read.on('error', cleanUp);
				src.read.pipe(write);
			} else {
				reject(new Error(
					'Source src argument is neither a readable stream or a filename.'
				));
			}
		});
	}
};

module.exports = File;