const SFTPClient = require('ssh2-sftp-client');
const fs = require('fs');
const path = require('path');

const ServiceBase = require('./Base');
const Paths = require('../lib/Paths');

class ServiceSFTP extends ServiceBase {
	constructor() {
		super();

		this.type = 'SFTP';
		this.clients = {};
		this.currentSettingsHash = null;
		this.maxClients = 2;

		this.paths = new Paths();

		// Define SFTP defaults
		this.serviceDefaults = {
			host: '',
			port: 22,
			username: '',
			password: '',
			privateKey: '',
			root: '/'
		};

		// Define SFTP validation rules
		this.serviceValidation = {
			host: true,
			username: true,
			root: true
		};
	}

	destructor() {
		Object.keys(this.clients).forEach((hash) => {
			this.removeClient(hash);
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
							return client.sftp;
						})
						.catch((error) => {
							this.showError(error)
						});
				} else {
					// Existing client - just return it
					return Promise.resolve(client.sftp);
				}
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
				console.log(`Using existing client (${hash})`);
				this.clients[hash].lastUsed = date.getTime();

				// Resolve with an existing client connection
				resolve(this.clients[hash]);
			} else {
				// Create a new client, removing old ones in case there are too many
				console.log(`Creating client instance (${hash})`);
				keys = Object.keys(this.clients);

				if (keys.length === this.maxClients) {
					console.log(`Removing ${keys.length - (this.maxClients - 1)} old clients`);
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
					console.log(`Removing client ${hash}`)
					this.clients[hash] = null;
					delete this.clients[hash];
				});
		} else {
			return Promise.resolve(false);
		}
	}

	put(src) {
		let dest = this.paths.replaceServiceContextWithRoot(
				src,
				this.config.serviceFilename,
				this.config.service.root
			),
			client;

		this.setProgress(`${path.basename(dest)}...`);

		return this.connect().then((connection) => {
			client = connection;
			return this.mkDir(path.dirname(dest), true);
		})
		.then(() => {
			console.log(`Putting ${src} to ${dest}...`);
			return client.put(src, dest);
		})
		.then(() => {
			console.log('Uploaded!');
			this.setProgress(false);
		})
		.catch((error) => {
			this.showError(error);
		});
	}

	get(src) {
		console.log(src);
		return true;
	}

	mkDir(dest, recursive = false) {
		return this.connect().then((connection) => {
			return connection.mkdir(dest, recursive);
		})
		.catch((error) => {
			this.showError(error);
		});
	}

	_getPrivateKey(file) {
		if (fs.existsSync(file)) {
			return fs.readFileSync(file, 'UTF-8');
		}
	}
};

module.exports = ServiceSFTP;