const SFTPClient = require('ssh2-sftp-client');
const fs = require('fs');
const path = require('path');
const homedir = require('os').homedir;
var micromatch = require("micromatch");

const ServiceBase = require('./Base');
const utils = require('../lib/utils');
const PathCache = require('../lib/PathCache');

const SRC_REMOTE = PathCache.sources.REMOTE;

class ServiceSFTP extends ServiceBase {
	constructor(options) {
		super(options);

		this.mkDir = this.mkDir.bind(this);

		this.type = 'SFTP';
		this.clients = {};
		this.maxClients = 2;
		this.pathCache = new PathCache();
		this.sftpError = null;
		this.transferReject = null;

		// Define SFTP defaults
		this.serviceDefaults = {
			host: '',
			port: 22,
			username: '',
			password: '',
			privateKey: '',
			root: '/',
			timeZoneOffset: 0,
			testCollisionTimeDiffs: true,
			collisionUploadAction: null,
			collisionDownloadAction: null,
			keepaliveInterval: 3000,
			debug: false
		};

		// Define SFTP validation rules
		this.serviceValidation = {
			host: true,
			username: true,
			root: true
		};
	}

	/**
	 * Class destructor. Removes all clients.
	 */
	destructor() {
		Object.keys(this.clients).forEach((hash) => {
			this.removeClient(hash);
		});
	}

	/**
	 * Runs initialisation code (before each queue begins)
	 */
	init(queueLength) {
		return super.init(queueLength)
			.then(() => {
				this.sftpError = null;

				return this.pathCache.clear();
			});
	}

	/**
	 * Sets the current configuration.
	 * @param {object} config
	 */
	setConfig(config) {
		super.setConfig(config);
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
				privateKey: this._getPrivateKey(),
				keepaliveInterval: this.config.service.keepaliveInterval
			},
			hash = this.config.serviceSettingsHash;

		if (this.config.service.password) {
			options.password = this.config.service.password;
		}

		if (this.config.service.debug) {
			options.debug = (data) => {
				console.log(`Client debug data: "${data}"`);
			}
		}

		return this.getClient(hash)
			.then((client) => {
				if (!client.lastUsed) {
					// New client - connect first
					console.log('Connecting to a new server instance...');

					return client.sftp.connect(options)
						.then(() => {
							this.onConnect();
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
									throw new Error(
										'SFTP could not find or access the root path. Please check' +
										` the "${this.config.settingsFilename}" settings file.`
									);
								});
						})
				} else {
					// Existing client - just return it
					return Promise.resolve(client.sftp);
				}
			})
			.catch((error) => {
				// Catch the native error and throw a better one
				if (error.code === 'ENOTFOUND' && error.level === 'client-socket') {
					// This is likely the error that means the client couldn't connect
					throw new Error(
						`Could not connect to server host ${options.host}:${options.port}`
					);
				}

				throw error;
			});
	}

	/**
	 * Stops any current transfers (by disconnecting all current clients)
	 */
	stop() {
		return this.disconnect();
	}

	/**
	 * Disconnects all current clients.
	 */
	disconnect() {
		let tasks = [], hash;

		this.setProgress(false);

		for (hash in this.clients) {
			tasks.push(
				this.clients[hash].sftp.end()
					.then(() => {
						this.clients[hash] = null;
						delete this.clients[hash];
					})
			);
		}

		return new Promise((resolve) => {
			Promise.all(tasks)
				.then(resolve);
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

						this.clients[hash].sftp.client
							.on('close', (hadError) => {
								this.onDisconnect((hadError || this.sftpError), hash);
							})
							.on('error', (error) => (this.sftpError = error));

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

	onDisconnect(hadError, hash) {
		super.onDisconnect(hadError);

		if (typeof this.transferReject === 'function') {
			this.transferReject();
		};

		this.removeClient(hash);
	}

	/**
	 * Put a single file to the SFTP server.
	 * @param {uri} local - Local source Uri.
	 * @param {string} remote - Remote destination pathname.
	 */
	put(local, remote) {
		let remoteDir = path.dirname(remote),
			remoteFilename = path.basename(remote),
			localPath = this.paths.getNormalPath(local);

		this.setProgress(`${remoteFilename}...`);

		return this.connect().then((connection) => {
			return this.mkDirRecursive(
				remoteDir,
				this.config.service.root,
				this.mkDir
			);
		})
		.then(() => this.getFileStats(remote, local))
		.then((stats) => super.checkCollision(
			stats.local,
			stats.remote,
			this.config.service.collisionUploadAction
		))
		.then((result) => {
			// Figure out what to do based on the collision (if any)
			if (result === false) {
				// No collision, just keep going
				this.channel.appendLine(`>> ${remote}`);
				return this.clientPut(localPath, remote);
			} else {
				this.setCollisionOption(result);

				switch (result.option) {
					case utils.collisionOpts.stop:
						throw utils.errors.stop;

					case utils.collisionOpts.skip:
						return false;

					case utils.collisionOpts.overwrite:
						this.channel.appendLine(`>> ${remote}`);
						return this.clientPut(localPath, remote);

					case utils.collisionOpts.rename:
						return this.list(remoteDir)
							.then((dirContents) => {
								let remotePath = remoteDir + '/' + this.getNonCollidingName(
										remoteFilename,
										dirContents
									);
								this.channel.appendLine(`>> ${remotePath}`);

								return this.put(
									local,
									remotePath
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
	 * @param {uri} local - Local destination Uri.
	 * @param {string} remote - Remote source filename.
	 * @description
	 * Get a single file from the SFTP server.
	 */
	get(local, remote) {
		let localPath = this.paths.getNormalPath(local),
			remoteDir = path.dirname(remote),
			remoteFilename = path.basename(remote);

		this.setProgress(`${remoteFilename}...`);

		return this.connect()
			.then(() => {
				// List the source directory in order to cache the file data
				return this.list(remoteDir)
					.catch((error) => {
						throw(error.message);
					});
			})
			.then(() => this.getFileStats(remote, local))
			.then((stats) => {
				if (!stats.remote) {
					throw(`Remote file "${remote}" does not exist.`);
				}

				return super.checkCollision(
					stats.remote,
					stats.local,
					this.config.service.collisionDownloadAction
				);
			})
			.then((result) => {
				// Figure out what to do based on the collision (if any)
				if (result === false) {
					// No collision, just keep going
					this.channel.appendLine(`<< ${remote}`);
					return this.clientGetByStream(localPath, remote);
				} else {
					this.setCollisionOption(result);

					switch (result.option) {
						case utils.collisionOpts.stop:
							throw utils.errors.stop;

						case utils.collisionOpts.skip:
						case undefined:
							return false;

						case utils.collisionOpts.overwrite:
							this.channel.appendLine(`<< ${remote}`);
							return this.clientGetByStream(localPath, remote);

						case utils.collisionOpts.rename:
							return this.list(remoteDir)
								.then((dirContents) => {
									let remotePath = remoteDir + '/' + this.getNonCollidingName(
											remoteFilename,
											dirContents
										);
									this.channel.appendLine(`<< ${remotePath}`);

									return this.clientGetByStream(
										local,
										remotePath
									);
								});

					}

					return false;
				}
			})
			.catch((error) => {
				console.log(`error! ${error.message || error}`);
				this.setProgress(false);
				throw(error);
			});
	}

	clientPut(local, remote) {
		return new Promise((resolve, reject) => {
			this.transferReject = reject;

			this.connect().then((client) => {
				client.put(local, remote)
					.then(resolve)
					.catch(reject);
			});
		});
	}

	/**
	 * Retrieves a file from the server using its get stream method.
	 * @param {string} local - Local pathname.
	 * @param {string} remote - Remote pathname.
	 */
	clientGetByStream(local, remote) {
		let client;

		return this.connect()
			.then((connection) => {
				client = connection;
			})
			.then(() => {
				return this.paths.ensureDirExists(path.dirname(local));
			})
			.then(() => {
				return this.getMimeCharset(remote);
			})
			.then((charset) => {
				return new Promise((resolve, reject) => {
					// Get file with client#get and stream to local pathname
					this.transferReject = reject;

					client.get(remote, true, charset === 'binary' ? null : 'utf8')
						.then((stream) => {
							console.log(`creating write stream for ${local}...`);
							let write = fs.createWriteStream(local);

							function cleanUp(error) {
								stream.destroy();
								write.end();
								reject(error.message);
							}

							// Set up write stream
							write.on('error', cleanUp);
							write.on('finish', resolve);

							stream.on('error', cleanUp);
							stream.pipe(write);
						})
						.catch((error) => {
							throw(error.message);
						});
				});
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
								this.pathCache.addCachedFile(
									SRC_REMOTE,
									dir,
									((new Date()).getTime() / 1000),
									'd'
								);
							});
					} else if (existing.type === 'f') {
						return Promise.reject(
							`Directory "${dir}" could not be created` +
							` (a file with the same name exists on the remote!)`
						);
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
	 * @param {string} ignoreGlobs - List of globs to ignore.
	 */
	list(dir, ignoreGlobs) {
		if (this.pathCache.dirIsCached(SRC_REMOTE, dir)) {
			// Retrieve cached path list
			// TODO: Allow ignoreGlobs option on this route
			return Promise.resolve(this.pathCache.getDir(SRC_REMOTE, dir));
		} else {
			// Get path list interactively and cache
			return this.connect()
				.then((connection) => {
					return connection.list(dir)
						.then((list) => {
							list.forEach((item) => {
								let match,
									pathName = dir + '/' + item.name;

								if (ignoreGlobs && ignoreGlobs.length) {
									match = micromatch([pathName], ignoreGlobs);
								}

								if (!match || !match.length) {
									this.pathCache.addCachedFile(
										SRC_REMOTE,
										pathName,
										(item.modifyTime / 1000),
										(item.type === 'd' ? 'd' : 'f')
									);
								}
							});

							return this.pathCache.getDir(SRC_REMOTE, dir);
						});
				});
		}
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
		let counter = {
			scanned: 0,
			total: 0
		};

		return new Promise((resolve, reject) => {
			this.cacheRecursiveList(dir, counter, ignoreGlobs, () => {
				if (counter.scanned === counter.total) {
					resolve(this.pathCache.getRecursiveFiles(
						PathCache.sources.REMOTE,
						dir
					));
				}
			}).catch(reject)
		});
	}

	/**
	 * Recursively adds a directory to the pathCache cache.
	 * @param {string} dir - Directory path
	 * @param {object} counter - Counter object. Must contain `total` and `scanned`
	 * properties with `0` number values.
	 * @param {array} ignoreGlobs - An optional array of globs to ignore
	 * @param {function} callback - An optional callback function to fire when all
	 * of the listed directories have been cached.
	 */
	cacheRecursiveList(dir, counter, ignoreGlobs, callback) {
		if (counter.total === 0) {
			// Ensure counter total starts at 1 (to include the current directory)
			counter.total = 1;
		}

		return this.list(dir, ignoreGlobs)
			.then((dirContents) => {
				let dirs;

				counter.scanned += 1;

				if (dirContents !== null) {
					dirs = dirContents.filter((file) => {
						return (file.type === 'd');
					});

					counter.total += dirs.length;

					dirs.forEach((file) => {
						this.cacheRecursiveList(
							dir + '/' + file.name,
							counter,
							ignoreGlobs,
							callback
						);
					});
				}

				callback(counter);
			});
	}

	/**
	 * Obtains local/remote stats for a file.
	 * @param {string} remote - Remote pathname.
	 * @param {uri} local - Local Uri.
	 */
	getFileStats(remote, local) {
		const remoteDir = path.dirname(remote);

		let result = {};

		return this.list(remoteDir)
			.then(() => {
				return new Promise((resolve) => {
					const localPath = this.paths.getNormalPath(local);

					fs.stat(localPath, (error, stat) => {
						if (!error && stat) {
							result.local = {
								name: path.basename(localPath),
								modified: (stat.mtime.getTime() / 1000),
								type: (stat.isDirectory() ? 'd' : 'f')
							};


						} else {
							result.local = null;
						}

						resolve();
					});
				});
			})
			.then(() => {
				result.remote = this.pathCache.getFileByPath(
					SRC_REMOTE,
					remote
				);

				return result;
			})
	}

	/**
	 * Retrieves the contents of a private key. Will fall back to the current home
	 * folder if no path is specified.
	 * @param {string} file
	 */
	_getPrivateKey() {
		let keyFile = this.config.service.privateKey || this.config.privateSSHKey,
			homeDir, defaultKeyFiles, a;

		if (fs.existsSync(keyFile)) {
			return fs.readFileSync(keyFile, 'UTF-8');
		}

		// Fall back to attempting to find by default
		homeDir = homedir();
		defaultKeyFiles = [
			homeDir + '/.ssh/identity',
			homeDir + '/.ssh/id_dsa',
			homeDir + '/.ssh/id_rsa',
		];

		for (a = 0; a < defaultKeyFiles.length; a += 1) {
			if (fs.existsSync(defaultKeyFiles[a])) {
				// Save privateKey location for session...
				this.config.service.privateKey = defaultKeyFiles[a];

				// ... Then return
				return fs.readFileSync(defaultKeyFiles[a], 'UTF-8');
			}
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