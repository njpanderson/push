const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const ServiceBase = require('./Base');
const utils = require('../lib/utils');
const ExtendedStream = require('../lib/ExtendedStream');
const PathCache = require('../lib/PathCache');

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
	 * Put a single file to the SFTP server.
	 * @param {uri|stream.Readable} src - Source Uri or Readable stream instance.
	 * @param {string} dest - Destination pathname.
	 */
	put(src, dest) {
		let destDir = path.dirname(dest),
			destFilename = path.basename(dest),
			srcPath = this.paths.getPathFromStreamOrUri(src);

		this.setProgress(`${destFilename}...`);

		return this.mkDirRecursive(destDir, this.config.service.root, this.mkDir)
			.then(() => {
				return this.checkCollision(dest, src);
			})
			.then((result) => {
				// Figure out what to do based on the collision (if any)
				if (result.option == true) {
					// No collision, just keep going
					console.log(`Putting ${srcPath} to ${dest}...`);
					return this.copy(src, dest);
				} else {
					switch (result.option) {
						case utils.collisionOpts.stop:
							throw utils.errors.stop;

						case utils.collisionOpts.skip:
							console.log(`Skipping ${dest}...`);
							return false;

						case utils.collisionOpts.overwrite:
							console.log(`Putting ${srcPath} to ${dest}...`);
							return this.copy(src, dest);

						case utils.collisionOpts.rename:
							console.log(`Renaming ${dest}...`);
							return this.list(destDir)
								.then((dirContents) => {
									return this.put(
										src,
										destDir + '/' + this.getNonCollidingName(destFilename, dirContents)
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

	get(src) {
		throw new Error('Get not implemented');
	}

	/**
	 * Recursively creates direcotories up to and including the basename of the given path.
	 * Will reject on an incompatible collision.
	 * @param {string} dest - Destination directory to create
	 */
	mkDir(dest) {
		return this.list(path.dirname(dest))
			.then(() => {
				let existing = this.pathCache.getFileByPath(PathCache.sources.REMOTE, dest);

				if (existing === null) {
					return new Promise((resolve, reject) => {
						fs.mkdir(dest, (error) => {
							if (error) {
								reject(error);
							}

							// Add dir to cache
							// TODO: maybe replace with a cache clear on the directory above?
							this.pathCache.addCachedFile(
								PathCache.sources.REMOTE,
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
		if (this.pathCache.dirIsCached(PathCache.sources.REMOTE, dir)) {
			// console.log(`Retrieving cached file list for "${dir}"...`);
			return Promise.resolve(this.pathCache.getDir(PathCache.sources.REMOTE, dir));
		} else {
			// console.log(`Retrieving live file list for "${dir}"...`);
			return new Promise((resolve, reject) => {
				fs.readdir(dir, (error, list) => {
					if (error) {
						reject(error);
					}

					list.forEach((filename) => {
						let pathname = dir + '/' + filename,
							stats = fs.statSync(pathname);

						this.pathCache.addCachedFile(
							PathCache.sources.REMOTE,
							pathname,
							(stats.mtime.getTime() / 1000),
							(stats.isDirectory() ? 'd' : 'f')
						);
					});

					resolve(this.pathCache.getDir(PathCache.sources.REMOTE, dir));
				});
			});
		}
	}

	/**
	 * Checks for a potential file collision between the remote `dest` pathname and
	 * the `local` Uri. Will display a collision picker if this occurs.
	 * @param {string} remote - Remote pathname.
	 * @param {uri|stream} local - Local Uri.
	 */
	checkCollision(remote, local) {
		const remoteFilename = path.basename(remote),
			remoteDir = path.dirname(remote);

		return this.list(remoteDir)
			.then(() => {
				let remoteStat = this.pathCache.getFileByPath(PathCache.sources.REMOTE, remote),
					localStat, localType, localMTime, timediff;

				if (local instanceof vscode.Uri) {
					localStat = fs.statSync(this.paths.getNormalPath(local));
					localType = (localStat.isDirectory() ? 'd' : 'f');
					localMTime = (localStat.mtime.getTime() / 1000);
				} else if (local instanceof ExtendedStream) {
					localType = local.fileData.type;
					localMTime = local.fileData.modified;
				} else {
					throw new Error(
						'Argument `local` is neither a readable stream or a filename.'
					);
				}

				timediff = (
					localMTime -
					(remoteStat.modified + this.config.service.timeZoneOffset)
				);

				if (remoteStat &&
					(
						(this.config.service.testCollisionTimeDiffs && timediff < 0) ||
						!this.config.service.testCollisionTimeDiffs
					)) {
					// Remote file exists and difference means local file is older
					if (remoteStat.type === localType) {
						return utils.showFileCollisionPicker(
							remoteFilename
						);
					} else {
						return utils.showMismatchCollisionPicker(
							remoteFilename
						);

					}
				}

				return true;
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

				if (src instanceof vscode.Uri) {
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