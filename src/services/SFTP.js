const SFTPClient = require('ssh2-sftp-client');
const fs = require('fs');
const path = require('path');

const ServiceBase = require('./Base');
const utils = require('../lib/utils');
const PathCache = require('../lib/PathCache');

class ServiceSFTP extends ServiceBase {
	constructor() {
		super();

		this.type = 'SFTP';
		this.clients = {};
		this.currentSettingsHash = null;
		this.maxClients = 2;
		this.pathCache = new PathCache();

		// Define SFTP defaults
		this.serviceDefaults = {
			host: '',
			port: 22,
			username: '',
			password: '',
			privateKey: '',
			root: '/',
			timeZoneOffset: 0
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
		return new Promise((resolve) => {
			this.pathCache.clear();
			resolve();
		});
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
	 * @param {string} src
	 * @param {string} dest
	 */
	put(src, dest) {
		let dir = path.dirname(dest),
			filename = path.basename(dest),
			client;

		this.setProgress(`${filename}...`);

		return this.connect().then((connection) => {
			client = connection;
			return this.mkDirRecursive(dir);
		})
		.then(() => {
			return this.checkCollision(src, dest);
		})
		.then((option) => {
			// Figure out what to do based on the collision (if any)
			if (option == true) {
				// No collision, just keep going
				console.log(`Putting ${src} to ${dest}...`);
				return client.put(src, dest);
			} else {
				switch (option) {
					case utils.collisionOpts.stop:
						throw utils.errors.stop;

					case utils.collisionOpts.skip:
						console.log(`Skipping ${dest}...`);
						return false;

					case utils.collisionOpts.overwrite:
						console.log(`Putting ${src} to ${dest}...`);
						return client.put(src, dest);

					case utils.collisionOpts.rename:
						console.log(`Renaming ${dest}...`);
						return this.list(dir)
							.then((dirContents) => {
								return this.put(
									src,
									dir + '/' + this.getNonCollidingName(filename, dirContents)
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

	mkDirRecursive(dest) {
		let baseDest, recursiveDest, dirList;

		if (dest === this.config.service.root) {
			// Resolve the promise immediately as the root directory must exist
			return Promise.resolve();
		}

		if (dest.startsWith(this.config.service.root)) {
			baseDest = dest.replace(this.config.service.root + '/', '');
			recursiveDest = baseDest.split('/');
			dirList = [];

			// First, create a directory list for the Promise loop to iterate over
			recursiveDest.reduce((acc, current) => {
				let dir = (acc === '' ? current : (acc + '/' + current));

				if (dir !== '') {
					dirList.push(this.config.service.root + '/' + dir);
				}

				return dir;
			}, '');

			return this.mkDirByList(dirList);
		}

		return Promise.reject('Directory is outside of root and cannot be created.');
	}

	mkDirByList(list) {
		let dir = list.shift();

		if (dir !== undefined) {
			return this.mkDir(dir)
				.then(() => {
					return this.mkDirByList(list);
				})
				.catch((error) => {
					throw error;
				});
		}

		return Promise.resolve();
	}

	/**
	 * Recursively creates direcotories up to and including the basename of the given path.
	 * Will reject on an incompatible collision.
	 * @param {string} dest - Destination directory to create
	 */
	mkDir(dest) {
		return this.connect().then((connection) => {
			return this.list(path.dirname(dest))
				.then(() => {
					let existing = this.pathCache.getFileByPath(PathCache.sources.REMOTE, dest);

					if (existing === null) {
						connection.mkdir(dest)
							.then(() => {
								let date = new Date();
								// Add dir to cache
								// TODO: maybe replace with a cache clear on the directory above?
								this.pathCache.addCachedFile(
									PathCache.sources.REMOTE,
									dest,
									(date.getTime() / 1000),
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

	list(dir) {
		if (this.pathCache.dirIsCached(PathCache.sources.REMOTE, dir)) {
			// console.log(`Retrieving cached file list for "${dir}"...`);
			return Promise.resolve(this.pathCache.getDir(PathCache.sources.REMOTE, dir));
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
										PathCache.sources.REMOTE,
										dir + '/' + item.name,
										(item.modifyTime / 1000),
										(item.type === 'd' ? 'd' : 'f')
									);
								});
							}

							return this.pathCache.getDir(PathCache.sources.REMOTE, dir);
						});
				});
		}
	}

	checkCollision(src, dest) {
		const filename = path.basename(dest),
			dir = path.dirname(dest);

		return this.list(dir)
			.then(() => {
				const srcStat = fs.statSync(src);

				let existing = this.pathCache.getFileByPath(PathCache.sources.REMOTE, dest),
					srcType = (srcStat.isDirectory() ? 'd' : 'f');

				if (existing) {
					return utils.showFileCollisionPicker(filename, (existing.type !== srcType));
				}

				return true;
			});
	}

	_getPrivateKey(file) {
		if (fs.existsSync(file)) {
			return fs.readFileSync(file, 'UTF-8');
		}
	}
};

module.exports = ServiceSFTP;