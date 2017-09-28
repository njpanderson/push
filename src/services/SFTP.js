const SFTPClient = require('ssh2-sftp-client');
const fs = require('fs');
const path = require('path');

const ServiceBase = require('./Base');
const File = require('./File');
const utils = require('../lib/utils');
const PathCache = require('../lib/PathCache');

const SRC_REMOTE = PathCache.sources.REMOTE;

class ServiceSFTP extends ServiceBase {
	constructor() {
		super();

		this.mkDir = this.mkDir.bind(this);

		this.type = 'SFTP';
		this.clients = {};
		this.maxClients = 2;
		this.pathCache = new PathCache();
		this.file = new File();

		// Define SFTP defaults
		this.serviceDefaults = {
			host: '',
			port: 22,
			username: '',
			password: '',
			privateKey: '',
			root: '/',
			timeZoneOffset: 0,
			testCollisionTimeDiffs: true
		};

		// Define SFTP validation rules
		this.serviceValidation = {
			host: true,
			username: true,
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
		return super.init()
			.then(() => {
				return this.pathCache.clear();
			});
	}

	setConfig(config) {
		super.setConfig(config);

		// Set configuration for file class
		this.file.setConfig({
			service: {
				root: this.paths.getCurrentWorkspaceRootPath(),
				timeZoneOffset: -(this.config.service.timeZoneOffset),
				testCollisionTimeDiffs: this.config.service.testCollisionTimeDiffs
			}
		})
	}

	/**
	 * Connect to an SSH server, returning a Promise resolving to a client instance.
	 * @returns {promise} - Promise resolving to a connected SFTP client instance.
	 */
	connect() {
		let options = {
				host: this.config.service.host,
				port: this.config.service.port,
				username: this.config.service.username,
				privateKey: this._getPrivateKey(this.config.service.privateKey || this.config.privateKey)
			},
			hash = this.config.serviceSettingsHash;

		if (this.config.service.password) {
			options.password = this.config.service.password;
		}

		return this.getClient(hash)
			.then((client) => {
				if (!client.lastUsed) {
					// New client - connect first
					return client.sftp.connect(options)
						.then(() => {
							console.log(`SFTP client connected to host ${options.host}:${options.port}`);
							return client;
						})
						.then((client) => {
							// Attempt to list the root path to ensure it exists
							return client.sftp.list(this.config.service.root)
								.then(() => {
									return client.sftp;
								})
								.catch(() => {
									utils.showError(
										`SFTP could not find or access the root path. Please check` +
										` the "${this.config.settingsFilename}" settings file.`
									);
								});
						})
						.catch((error) => {
							utils.showError(error)
						});
				} else {
					// Existing client - just return it
					return Promise.resolve(client.sftp);
				}
			})
			.catch((error) => {
				utils.showError(error);
			});
	}

	/**
	 * Returns a Promise eventually resolving to a new client instance, with the addition
	 * of performing cleanup to ensure a maximum number of client instances exist.
	 * @param {string} hash
	 * @returns {promise} - Promise resolving to an SFTP client instance.
	 */
	getClient(hash) {
		let date = new Date(),
			results = [],
			keys;

		return new Promise((resolve) => {
			if (this.clients[hash]) {
				// Return the existing client instance
				this.clients[hash].lastUsed = date.getTime();

				// Resolve with an existing client connection
				resolve(this.clients[hash]);
			} else {
				// Create a new client, removing old ones in case there are too many
				keys = Object.keys(this.clients);

				if (keys.length === this.maxClients) {
					// Remove old clients
					keys.sort((a, b) => {
						return this.clients[a].lastUsed - this.clients[b].lastUsed;
					});

					keys.slice(this.maxClients - 1).forEach((hash) => {
						results.push(this.removeClient(hash));
					});
				}

				// Wait until all old clients have disconnected
				Promise.all(results)
					.then(() => {
						// Create a new client
						this.clients[hash] = {
							lastUsed: 0,
							sftp: new SFTPClient()
						};

						this.clients[hash].sftp.client.on('close', () => {
							this.removeClient(hash);
						});

						// Resolve with new client connection
						resolve(this.clients[hash]);
					});
			}
		});
	}

	/**
	 * Removes a single SFTP client instance by its options hash.
	 * @param {string} hash
	 */
	removeClient(hash) {
		if (this.clients[hash]) {
			return this.clients[hash].sftp.end()
				.then(() => {
					this.clients[hash] = null;
					delete this.clients[hash];
				});
		} else {
			return Promise.resolve(false);
		}
	}

	/**
	 * Put a single file to the SFTP server.
	 * @param {uri} src - Source Uri.
	 * @param {string} dest - Destination pathname.
	 */
	put(src, dest) {
		let destDir = path.dirname(dest),
			destFilename = path.basename(dest),
			srcPath = this.paths.getNormalPath(src),
			client;

		this.setProgress(`${destFilename}...`);

		return this.connect().then((connection) => {
			client = connection;
			return this.mkDirRecursive(
				destDir,
				this.config.service.root,
				this.mkDir
			);
		})
		.then(() => {
			return this.checkCollision(dest, src);
		})
		.then((result) => {
			// Figure out what to do based on the collision (if any)
			if (result.option == true) {
				// No collision, just keep going
				console.log(`Putting ${srcPath} to ${dest}...`);
				return client.put(srcPath, dest);
			} else {
				if (result.option && result.option.baseOption) {
					// Save collision options from "All" option
					this.collisionOptions[result.type] = result.option.baseOption;
				}

				switch (result.option) {
					case utils.collisionOpts.stop:
						throw utils.errors.stop;

					case utils.collisionOpts.skip:
						console.log(`Skipping ${dest}...`);
						return false;

					case utils.collisionOpts.overwrite:
						console.log(`Putting ${srcPath} to ${dest}...`);
						return client.put(srcPath, dest);

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

	/**
	 * @param {uri} dest - Destination Uri.
	 * @param {string} src - Source filename.
	 * @description
	 * Get a single file from the SFTP server.
	 *
	 * **Note:** The arguments to `get` are reversed from `put` in order to be able
	 * to utilise this method alongside put in a more re-usable way.
	 */
	get(dest, src) {
		let destPath = this.paths.getNormalPath(dest),
			srcDir = path.dirname(src),
			srcFilename = path.basename(src),
			client;

		this.setProgress(`${srcFilename}...`);

		return this.connect()
			.then((connection) => {
				// List the source directory in order to cache the file data
				client = connection;
				return this.list(srcDir);
			})
			.then(() => {
				return this.getMimeCharset(src);
			})
			.then((charset) => {
				// Use the File class to put a file from the source to the dest
				return client.get(src, true, charset === 'binary' ? null : 'utf8')
					.then((stream) => {
						// Use File#put to send the file from the server to the local filesystem
						return this.file.put(
							this.pathCache.extendStream(stream, SRC_REMOTE, src),
							destPath
						);
					})
					.catch((error) => {
						throw(error.message);
					});
			})
			.catch((error) => {
				this.setProgress(false);
				throw(error);
			});
	}

	/**
	 * Creates a single directory at the specified remote destination.
	 * Will reject on an incompatible collision.
	 * @param {string} dir - Destination directory to create
	 */
	mkDir(dir) {
		return this.connect().then((connection) => {
			return this.list(path.dirname(dir))
				.then(() => {
					let existing = this.pathCache.getFileByPath(SRC_REMOTE, dir);

					if (existing === null) {
						return connection.mkdir(dir)
							.then(() => {
								// Add dir to cache
								// TODO: maybe replace with a cache clear on the directory above?
								this.pathCache.addCachedFile(
									SRC_REMOTE,
									dir,
									((new Date()).getTime() / 1000),
									'd'
								);
							});
					} else if (existing.type === 'f') {
						return Promise.reject(new Error(
							'Directory could not be created' +
							' (a file with the same name exists on the remote!)'
						));
					}
				});
		})
		.catch((error) => {
			throw error;
		});
	}

	/**
	 * Return a list of the remote directory.
	 * @param {string} dir - Remote directory to list
	 */
	list(dir) {
		if (this.pathCache.dirIsCached(SRC_REMOTE, dir)) {
			// console.log(`Retrieving cached file list for "${dir}"...`);
			return Promise.resolve(this.pathCache.getDir(SRC_REMOTE, dir));
		} else {
			// console.log(`Retrieving live file list for "${dir}"...`);
			return this.connect()
				.then((connection) => {
					return connection.list(dir)
						.then((list) => {
							// console.log(`Caching path list for "${dir}"...`);
							if (list) {
								list.forEach((item) => {
									this.pathCache.addCachedFile(
										SRC_REMOTE,
										dir + '/' + item.name,
										(item.modifyTime / 1000),
										(item.type === 'd' ? 'd' : 'f')
									);
								});
							}

							return this.pathCache.getDir(SRC_REMOTE, dir);
						});
				});
		}
	}

	/**
	 * Checks for a potential file collision between the `remote` pathname and
	 * the `local` Uri. Will display a collision picker if this occurs.
	 * @param {string} remote - Remote pathname.
	 * @param {uri} local - Local Uri.
	 */
	checkCollision(remote, local) {
		const remoteFilename = path.basename(remote),
			remoteDir = path.dirname(remote),
			collisionType = 'file';

		return this.list(remoteDir)
			.then(() => {
				const localStat = fs.statSync(this.paths.getNormalPath(local)),
					remoteStat = this.pathCache.getFileByPath(SRC_REMOTE, remote),
					localMTime = (localStat.mtime.getTime() / 1000);

				let timediff, localType = (localStat.isDirectory() ? 'd' : 'f');

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
						if (this.collisionOptions[collisionType]) {
							return {
								type: collisionType,
								option: this.collisionOptions[collisionType]
							};
						} else {
							return utils.showFileCollisionPicker(
								remoteFilename,
								this.collisionOptions.file
							);
						}
					} else {
						return utils.showMismatchCollisionPicker(
							remoteFilename
						);
					}
				}

				return true;
			});
	}

	_getPrivateKey(file) {
		if (fs.existsSync(file)) {
			return fs.readFileSync(file, 'UTF-8');
		}
	}

	/**
	 * @param {string} file - Remote file to test.
	 * @description
	 * Retrieves the mime data from a file. Uses the `file` command on an SFTP server.
	 * Falls back to extension based checking.
	 */
	getMimeCharset(file) {
		return this.connect().then((connection) => {
			return new Promise((resolve, reject) => {
				connection.client.exec(`file --mime ${file}`, (error, stream) => {
					let totalData = '', totalErrorData = '';

					if (error) {
						reject(error);
					}

					stream.on('close', (code) => {
						let charsetMatch = totalData.match(/charset=([^\s\n]+)/);

						if (totalErrorData ||
							!totalData ||
							charsetMatch === null ||
							code !== 0) {
							resolve(this.getBasicMimeCharset(file));
						} else {
							resolve(charsetMatch[1]);
						}
					}).on('data', (data) => {
						totalData += data;
					}).stderr.on('data', (data) => {
						totalErrorData += data;
					});
				});
			});
		});
	}

	/**
	 * Performs a basic check for charset based on file extension alone.
	 * @param {string} file - Remote file to test.
	 */
	getBasicMimeCharset(file) {
		const ext = path.extname(file);

		if (ServiceSFTP.encodingByExtension.utf8.indexOf(ext) !== -1) {
			return 'utf8';
		}

		return 'binary';
	}
};

ServiceSFTP.encodingByExtension = {
	'utf8': [
		'.txt', '.html', '.shtml', '.js', '.jsx', '.css', '.less', '.sass',
		'.php', '.asp', '.aspx', '.svg', '.sql', '.rb', '.py', '.log', '.sh', '.bat',
		'.pl', '.cgi', '.htaccess'
	]
}

module.exports = ServiceSFTP;