const vscode = require('vscode');
const ProviderSFTPClient = require('ssh2-sftp-client');
const ssh = require('ssh2').Client;
const fs = require('fs');
const path = require('path');
const homedir = require('os').homedir;
const micromatch = require('micromatch');

const ProviderBase = require('../../ProviderBase');
const TransferResult = require('../TransferResult');
const utils = require('../../lib/utils');
const PushError = require('../../lib/types/PushError');
const channel = require('../../lib/channel');
const i18n = require('../../i18n');
const { TRANSFER_TYPES } = require('../../lib/constants');

/**
 * ProviderSFTP transfers.
 */
class ProviderSFTP extends ProviderBase {
	constructor(options, defaults, required) {
		super(options, defaults, required);

		this.mkDir = this.mkDir.bind(this);

		this.type = 'SFTP';
		this.clients = {};
		this.sftpError = null;
		this.globalReject = null;

		this.options.maxClients = 2;
		this.options.modeGlob = {
			dot: true,
			nocase: true,
			strictSlashes: true
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
	 * @description
	 * Merges the service specific default settings with supplied object.
	 * ProviderSFTP variant that also detects and merges SSH gateway settings.
	 * @param {object} settings
	 */
	mergeWithDefaults(settings) {
		let newSettings = Object.assign({}, this.serviceDefaults, settings);

		// If there is a gateway defined, merge that
		if (newSettings.sshGateway) {
			newSettings.sshGateway = Object.assign(
				{},
				ProviderSFTP.gatewayDefaults,
				newSettings.sshGateway
			);
		}

		return newSettings;
	}

	/**
	 * Runs initialisation code (before each queue begins)
	 */
	init(queueLength) {
		return super.init(queueLength)
			.then(() => {
				this.sftpError = null;
			})
			.then(() => this.pathCache.local.clear())
			.then(() => this.pathCache.remote.clear());
	}

	/**
	 * Connect to an SSH server, returning a Promise resolving to a client instance.
	 * @returns {Promise<object>} Promise resolving to a connected ProviderSFTP client instance.
	 */
	connect() {
		let hash = this.config.serviceSettingsHash;

		return this.getClient(hash)
			.then((client) => {
				if (!client.lastUsed) {
					// New client - connect first
					if (client.gateway) {
						return this.openGatewayConnection(client);
					} else {
						return this.openConnection(client);
					}
				} else {
					// Existing client - just return it
					return Promise.resolve(client.sftp);
				}
			})
			.catch((error) => {
				// Catch the native error and throw a better one
				if (error.code === 'ENOTFOUND' && error.level === 'client-socket') {
					// This is likely the error that means the client couldn't connect
					throw new PushError(
						i18n.t(
							'sftp_could_not_connect_server',
							this.config.service.host,
							this.config.service.port
						)
					);
				}

				throw error;
			});
	}

	/**
	 * Attempts to open a connection to the configured ProviderSFTP server.
	 * @param {object} client - ProviderSFTP client spec returned from {@link this.getClient}.
	 * @param {object} options - ProviderSFTP Option overrides.
	 * @return {promise} - Resolving to a connected ProviderSFTP instance.
	 */
	openConnection(client, options = {}) {
		utils.trace(
			'ProviderSFTP#openConnection',
			`Connecting (${this.credentialStamp(client)})...`
		);

		return client.sftp.connect(Object.assign({}, client.options, options))
			.then(() => {
				this.onConnect();

				if (client.gateway) {
					channel.appendLocalisedInfo(
						'sftp_client_connected_gateway',
						client.options.host,
						client.options.port,
						client.gatewayOptions.host,
						client.gatewayOptions.port
					);
				} else {
					channel.appendLocalisedInfo(
						'sftp_client_connected',
						client.options.host,
						client.options.port
					);
				}

				return client;
			})
			.then((client) => this.checkServiceRoot(client))
			.catch((error) => this.handleProviderSFTPError(error, client));
	}

	/**
	 * Open a connection to the ProviderSFTP server via the defined gateway server.
	 * @param {object} client - ProviderSFTP client spec.
	 * @returns {Promise<object>} Resolving to a connected ProviderSFTP instance.
	 */
	openGatewayConnection(client) {
		return new Promise((resolve, reject) => {
			utils.trace(
				'ProviderSFTP#openGatewayConnection',
				`Connecting (${this.credentialStamp(client)})...`
			);

			// Set up client gateway and connect to it
			client.gateway
				.on('ready', () => {
					if (client.options.privateKeyFile) {
						// Get the private key file contents from the gateway, then connect
						this.readWithSSH(client.gateway, client.options.privateKeyFile)
							.then((contents) => {
								client.options.privateKey = contents;

								this.connectGatewayProviderSFTP(client)
									// TODO: Implement and test
									// .then((client) => this.checkServiceRoot(client))
									.then(resolve, reject);
							})
							.catch((error) => {
								reject(i18n.t(
									'could_not_load_gateway_key',
									client.options.privateKeyFile,
									error.message
								));
							});
					} else {
						// Just connect
						this.connectGatewayProviderSFTP(client)
							// TODO: Implement and test
							// .then((client) => this.checkServiceRoot(client))
							.then(resolve, reject);
					}
				})
				.on('error', (error) => {
					this.channel.appendLocalisedError('error_from_gateway', error);
					reject('Gateway SSH error: ' + error.message);
				})
				.connect(client.gatewayOptions);
		});
	}

	/**
	 * Connect to an ProviderSFTP server via SSH gateway, resolving the connected ProviderSFTP instance.
	 * @param {Object} client - ProviderSFTP client spec.
	 * @returns {Promise<object>} Resolving to a connected ProviderSFTP instance.
	 */
	connectGatewayProviderSFTP(client) {
		return new Promise((resolve, reject) => {
			// Connect to the ProviderSFTP server (from the gateway)
			client.gateway.forwardOut(
				'127.0.0.1',
				client.gatewayOptions.port,
				client.options.host,
				client.options.port,
				(error, stream) => {
					if (error) {
						client.gateway.end();
						return reject(error);
					}

					this.openConnection(client, {
						host: null,
						port: null,
						sock: stream
					})
						.then(resolve)
						.catch(reject);
				}
			);
		});
	}

	handleProviderSFTPError(error, client) {
		return new Promise((resolve, reject) => {
			if (error.level === 'client-authentication') {
				// Put a note in the log to remind users that a password can be set
				if (client.options.privateKeyFile !== '') {
					// If there was a keyfile yet we're at this point, it might have broken
					channel.appendLocalisedInfo(
						'key_file_not_working',
						client.options.privateKeyFile,
						client.options.username
					);
				}

				this.channel.appendLocalisedInfo('requesting_password');

				// Offer to use a password
				this.requestAuthentication()
					.then((result) => {
						if (typeof result !== 'undefined') {
							// Temporarily set the password in the service config
							client.options.password = result;
							resolve(this.openConnection(client, client.options));
						} else {
							// No password provided (escaped)
							this.destroyClient(client);
							reject(error);
						}
					});
			} else {
				// This likely ain't happening - let's just ditch the client and reject
				this.destroyClient(client);
				reject(error);
			}
		});
	}

	/**
	 * Attempt to list the root path to ensure it exists
	 * @param {ProviderSFTP} client - ProviderSFTP client object.
	 * @param {function} resolve - Promise resolver function.
	 */
	checkServiceRoot(client) {
		return client.sftp.list(this.config.service.root)
			.then(() => {
				// Return the sftp object
				return client.sftp;
			})
			.catch(() => {
				throw new PushError(
					i18n.t('service_missing_root', this.config.settingsFilename)
				);
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
	 * Ends and then destroys a client's ProviderSFTP connection.
	 * @param {object} client - Client connection object.
	 */
	destroyClient(client) {
		let tasks = [];

		if (client.sftp && client.sftp.end) {
			utils.trace('ProviderSFTP#destroyClient', 'Ending client connection');
			tasks.push(client.sftp.end());
		}

		if (client.gateway && client.gateway.end) {
			utils.trace('ProviderSFTP#destroyClient', 'Ending client gateway connection');
			tasks.push(client.gateway.end());
		}

		return Promise.all(tasks)
			.then(() => {
				client.sftp = null;
				client.gateway = null;
			})
			.catch(() => {
				client.sftp = null;
				client.gateway = null;
			});
	}

	/**
	 * Returns a Promise eventually resolving to a new client instance, with the addition
	 * of performing cleanup to ensure a maximum number of client instances exist.
	 * @param {string} hash
	 * @returns {Promise<object>} Promise resolving to an ProviderSFTP client instance.
	 */
	getClient(hash) {
		let date = new Date(),
			results = [],
			keys;

		return new Promise((resolve) => {
			if (this.clients[hash] && this.clients[hash].sftp) {
				// Return the existing client instance
				this.clients[hash].lastUsed = date.getTime();

				utils.trace('Push#getClient', `Getting cached client (${hash})`);

				// Resolve with an existing client connection
				resolve(this.clients[hash]);
			} else {
				// Create a new client, removing old ones in case there are too many
				keys = Object.keys(this.clients);

				if (keys.length === this.options.maxClients) {
					utils.trace(
						'Push#getClient',
						`Purging ${(keys.length - this.options.maxClients)} old client(s)...`
					);

					// Remove old clients
					keys.sort((a, b) => {
						return this.clients[a].lastUsed - this.clients[b].lastUsed;
					});

					keys.slice(this.options.maxClients - 1).forEach((hash) => {
						results.push(this.removeClient(hash));
					});
				}

				// Wait until all old clients have disconnected
				Promise.all(results)
					.then(() => {
						utils.trace('Push#getClient', `Creating client (${hash})`);

						// Create a new client
						this.clients[hash] = {
							lastUsed: 0,
							sftp: new ProviderSFTPClient(),
							options: this.getClientOptions(
								this.config.service,
								!(this.config.service.sshGateway)
							)
						};

						if (this.config.service.sshGateway) {
							// Client is going to connect via a gateway - add its instance here
							this.clients[hash].gatewayOptions = this.getClientOptions(
								this.config.service.sshGateway
							);

							this.clients[hash].gateway = new ssh();
						}

						this.clients[hash].sftp.client
							// .on('keyboard-interactive', (name, instructions, prompts, finish) => {
							// 	console.log('keyboard-interactive event');
							// })
							.on('close', (error) => {
								// Check for local or global error (created by error event)
								let hadError = (error || this.sftpError);

								if (hadError && hadError.level) {
									utils.trace(
										'Push#getClient',
										`Close event (with error ${hadError.level})`
									);

									if (hadError.level === 'client-authentication') {
										// Error is regarding authentication - don't consider fatal
										hadError = false;
									} else {
										hadError = true;
									}
								} else {
									utils.trace('Push#getClient', 'Close event');

									hadError = false;
								}

								// Close SSH gateway connection, if exists
								if (this.clients[hash] && this.clients[hash].gateway) {
									this.clients[hash].gateway.end();
								}

								// Fire onDisconnect event method
								this.onDisconnect(hadError, hash);
							})
							.on('error', (error) => (this.sftpError = error));

						// Resolve with new client connection
						resolve(this.clients[hash]);
					});
			}
		});
	}

	/**
	 * Create an object of ProviderSFTP client options, given the service settings.
	 * @param {object} service - Service settings Object.
	 * @param {boolean} validateKey - Whether or not to validate the key file location.
	 */
	getClientOptions(service, validateKey = true) {
		let sshKey,
			options = {
				host: service.host,
				port: service.port,
				username: service.username,
				passphrase: service.keyPassphrase || this.config.privateSSHKeyPassphrase,
				keepaliveInterval: service.keepaliveInterval,
				tryKeyboard: true
			};

		if (validateKey) {
			// Validate key file and convert options
			sshKey = this._getPrivateKey(service);

			options.privateKey = (sshKey && sshKey.contents);
			options.privateKeyFile = (sshKey && sshKey.file);
		} else {
			// Just set the privateKeyFile property
			options.privateKeyFile = service.privateKey;
		}

		// Add a password, if set
		if (service.password) {
			options.password = service.password;
		}

		// Add a debugging logger, if requested
		if (service.debug) {
			options.debug = (data) => {
				channel.appendLine(`ProviderSFTP: "${data}"`);
			};
		}

		return options;
	}

	/**
	 * Removes a single ProviderSFTP client instance by its options hash.
	 * @param {string} hash
	 */
	removeClient(hash) {
		let client;

		if (!(client = this.clients[hash])) {
			return Promise.reject(`Could not find client with supplied hash (${hash})`);
		}

		if (client && client.sftp) {
			channel.appendLocalisedInfo(
				'sftp_disconnected',
				client.options.host,
				client.options.port
			);

			return this.destroyClient(client)
				.then(() => {
					// Nullify and delete the object
					this.clients[hash] = null;
					delete this.clients[hash];
				});
		} else {
			return Promise.resolve(false);
		}
	}

	/**
	 * Fired on disconnection of the ProviderSFTP client.
	 * @param {boolean} hadError - Whether or not an error occured.
	 * @param {string} hash - ProviderSFTP client hash (Generated by service settings).
	 */
	onDisconnect(hadError, hash) {
		// ProviderSFTP clients can be disconnected because of a buffer overflow.
		// This is an internal process to ProviderSFTP and should not be reported.
		if (hadError) {
			// Run the onDisconnect event
			super.onDisconnect(hadError);

			// If a global rejection function exists, invoke it
			if (typeof this.globalReject === 'function') {
				this.globalReject();
				this.globalReject = null;
			}

			this.removeClient(hash);
		}
	}

	/**
	 * Put a single file to the ProviderSFTP server.
	 * @param {Uri} local - Local source Uri.
	 * @param {string} remote - Remote destination pathname.
	 * @param {string} [collisionAction] - What to do on file collision. Use one
	 * of the utils.collisionOpts collision actions.
	 */
	put(local, remote, collisionAction) {
		let remoteDir = path.dirname(remote),
			remoteFilename = path.basename(remote);

		collisionAction = collisionAction ||
			this.config.service.collisionUploadAction;

		this.setProgress(`${remoteFilename}...`);

		return this.connect().then(() => {
			return this.mkDirRecursive(
				remoteDir,
				this.config.service.root,
				this.mkDir
			);
		})
			.then(() => {
				return this.getFileStats(remote, local);
			})
			.then((stats) => {
				if (!stats.local) {
					// No local file! return TransferResult error
					return new TransferResult(
						local,
						new PushError(i18n.t(
							'file_not_found',
							this.paths.getBaseName(local)
						)),
						TRANSFER_TYPES.PUT
					);
				}

				return super.checkCollision(
					stats.local,
					stats.remote,
					collisionAction
				);
			})
			.then((result) => {
				if (result instanceof TransferResult) {
					// Pass through TransferResult results
					return result;
				}

				// Figure out what to do based on the collision (if any)
				if (result === false) {
					// No collision, just keep going
					return this.clientPut(local, remote);
				} else {
					this.setCollisionOption(result);

					switch (result.option) {
					case utils.collisionOpts.stop:
						throw utils.errors.stop;

					case utils.collisionOpts.overwrite:
						return this.clientPut(local, remote);

					case utils.collisionOpts.rename:
						return this.list(remoteDir)
							.then((dirContents) => {
								return this.put(
									local,
									remoteDir + '/' + this.getNonCollidingName(
										remoteFilename,
										dirContents
									)
								);
							});

					case utils.collisionOpts.skip:
					default:
						return new TransferResult(local, false, TRANSFER_TYPES.PUT);
					}
				}
			})
			.then((result) => {
				// Clear remote cache
				this.pathCache.remote.clear(remoteDir);

				if ((result instanceof TransferResult) && !result.error) {
					// Transfer occured with no errors - set the remote file mode
					return this.setRemotePathMode(remote, this.config.service.fileMode)
						.then(() => result);
				}

				return result;
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
	 * Get a single file from the ProviderSFTP server.
	 * @param {Uri} local - Local destination Uri.
	 * @param {string} remote - Remote source filename.
	 * @param {string} [collisionAction] - What to do on file collision. Use one
	 * of the utils.collisionOpts collision actions.
	 */
	get(local, remote, collisionAction) {
		let localPath = this.paths.getNormalPath(local),
			localDir = path.dirname(localPath),
			remoteDir = path.dirname(remote),
			remoteFilename = path.basename(remote);

		collisionAction = collisionAction ||
			this.config.service.collisionDownloadAction;

		this.setProgress(`${remoteFilename}...`);

		return this.connect()
			.then(() => {
				// List the source directory in order to cache the file data
				return this.list(remoteDir)
					.catch((error) => {
						throw new PushError(
							i18n.t('cannot_list_directory', remoteDir, error.message)
						);
					});
			})
			.then(() => this.getFileStats(remote, local))
			.then((stats) => {
				if (!stats.remote) {
					return new TransferResult(
						local,
						new PushError(i18n.t(
							'remote_file_not_found',
							this.paths.getBaseName(remoteFilename)
						)),
						TRANSFER_TYPES.GET
					);
				}

				return super.checkCollision(
					stats.remote,
					stats.local,
					collisionAction
				);
			})
			.then((collision) => {
				// Figure out what to do based on the collision (if any)
				let localFilename;

				if (collision instanceof TransferResult) {
					return collision;
				}

				if (collision === false) {
					// No collision, just keep going
					return this.clientGetByStream(local, remote);
				} else {
					this.setCollisionOption(collision);

					switch (collision.option) {
					case utils.collisionOpts.stop:
						throw utils.errors.stop;

					case utils.collisionOpts.overwrite:
						return this.clientGetByStream(local, remote);

					case utils.collisionOpts.rename:
						localFilename = path.basename(localPath);

						// Rename (non-colliding) and get
						return this.paths.listDirectory(localDir, this.pathCache.local)
							.then((dirContents) => {
								let localPath = localDir + '/' +
									this.getNonCollidingName(
										localFilename,
										dirContents
									);

								return this.clientGetByStream(
									vscode.Uri.file(localPath),
									remote
								);
							});

					case utils.collisionOpts.skip:
					default:
						return new TransferResult(local, false, TRANSFER_TYPES.GET);
					}
				}
			})
			.then((result) => {
				this.pathCache.local.clear(localDir);

				return result;
			})
			.catch((error) => {
				this.setProgress(false);
				throw(error);
			});
	}

	/**
	 * Reads a file and returns its contents.
	 * @param {SSH2Client} ssh - A connected instance of SSH2Client.
	 * @returns {Promise<string>} resolving to the file's contents.
	 */
	readWithSSH(ssh, fileName) {
		return new Promise((resolve, reject) => {
			// Get sftp submodule
			ssh.sftp((err, sftp) => {
				if (err) {
					return reject(err);
				}

				// Open the file for reading
				sftp.open(fileName, 'r', (err, fd) => {
					if (err) {
						return reject(err);
					}

					// Use the file descriptor to stat the file
					sftp.fstat(fd, (err, stat) => {
						let offset = 0,
							length = stat.size,
							totalBytesRead = 0,
							bytesRead = 0,
							contents = '',
							buffer = new Buffer(length);

						// Read the file, then resolve its contents
						sftp.read(
							fd,
							buffer,
							offset,
							length,
							bytesRead,
							(error, bytesRead, buffer/*, position*/) => {
								totalBytesRead += bytesRead;

								contents += buffer.toString('utf8');

								// The whole file has been read - resolve
								if (totalBytesRead === length) {
									resolve(contents);
								}
							}
						);
					});
				});
			});
		});
	}

	setRemotePathMode(remote, mode) {
		return new Promise((resolve, reject) => {
			let modeMatch;

			if (Array.isArray(mode)) {
				try {
					modeMatch = this.config.service.fileMode.filter((match) =>
						micromatch.isMatch(remote, match.glob, this.options.modeGlob)
					);
				} catch(e) { reject(e); }


				if (modeMatch.length) {
					mode = modeMatch[0].mode;
				}
			}

			if (mode !== '' && typeof mode === 'string' && mode.length >= 3) {
				// Set mode and resolve
				return this.connect().then((client) => {
					try {
						client.sftp.chmod(remote, mode, resolve);
						utils.trace(
							'ProviderSFTP#setRemotePathMode',
							`Setting mode of ${remote} to ${mode}`
						)
					} catch(e) {
						reject(e);
					}
				});
			} else {
				// Just resolve
				resolve();
			}
		});
	}

	/**
	 * Uploads a single file using the SSH library.
	 * @param {Uri} local - Local Uri to put to the server.
	 * @param {string} remote - Remote path to replace upload to.
	 */
	clientPut(local, remote) {
		let localPath = this.paths.getNormalPath(local);

		return new Promise((resolve, reject) => {
			this.globalReject = reject;

			this.connect().then((client) => {
				utils.trace('ProviderSFTP#clientPut', remote);

				client.put(localPath, remote)
					.then(() => {
						resolve(new TransferResult(
							local,
							true,
							TRANSFER_TYPES.PUT, {
								srcLabel: remote
							}
						));
					})
					.catch((error) => {
						if (error.code === 'ENOENT') {
							// File no longer exists - skip (but don't stop)
							return resolve(new TransferResult(
								local,
								new PushError(i18n.t('file_not_found', localPath)),
								TRANSFER_TYPES.PUT
							));
						}

						// Other errors
						reject(new PushError(`${remote}: ${error.message}`));
					});
			});
		});
	}

	/**
	 * Retrieves a file from the server using its get stream method.
	 * @param {Uri} local - Local Uri.
	 * @param {string} remote - Remote pathname.
	 */
	clientGetByStream(local, remote) {
		let client,
			localPath = this.paths.getNormalPath(local);

		return this.connect()
			.then((connection) => {
				client = connection;
			})
			.then(() => this.paths.ensureDirExists(
				this.paths.getDirName(local)
			))
			.then(() => this.getMimeCharset(remote))
			.then((charset) => {
				return new Promise((resolve, reject) => {
					// Get file with client#get and stream to local pathname
					this.globalReject = reject;

					utils.trace('ProviderSFTP#clientGetByStream', remote);


					client.get(remote, localPath, {
						encoding: (charset === 'binary' ? null : 'utf8')
					})
						.then(() => {
							resolve(new TransferResult(
								local,
								true,
								TRANSFER_TYPES.GET
							));
						})
						.catch((error) => {
							resolve(new TransferResult(
								local,
								new PushError(error),
								TRANSFER_TYPES.GET
							));
						});

					// client.get(remote, true, charset === 'binary' ? null : 'utf8')
					// 	.then((stream) => {
					// 		utils.writeFileFromStream(stream, localPath, remote)
					// 			.then(() => {
					// 				resolve(new TransferResult(
					// 					local,
					// 					true,
					// 					TRANSFER_TYPES.GET
					// 				));
					// 			}, (error) => {
					// 				resolve(new TransferResult(
					// 					local,
					// 					new PushError(error),
					// 					TRANSFER_TYPES.GET
					// 				));
					// 			});
					// 	})
					// 	.catch((error) => {
					// 		throw new PushError(`${remote}: ${error && error.message}`);
					// 	});
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
					let existing = this.pathCache.remote.getFileByPath(dir);

					if (existing === null) {
						return connection.mkdir(dir)
							.then(() => {
								// Change path mode
								return this.setRemotePathMode(
									this.paths.addTrailingSlash(dir, '/'),
									this.config.service.fileMode
								);
							})
							.then(() => {
								// Add dir to cache
								this.pathCache.remote.addFilePath(
									dir,
									((new Date()).getTime() / 1000),
									'd'
								);
							});
					} else if (existing.type === 'f') {
						return Promise.reject(
							i18n.t('directory_not_created_remote_mismatch', dir)
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
		if (this.pathCache.remote.dirIsCached(dir)) {
			// Retrieve cached path list
			// TODO: Allow ignoreGlobs option on this route
			utils.trace('ProviderSFTP#list', `Using cached path for ${dir}`);
			return Promise.resolve(this.pathCache.remote.getDir(dir));
		} else {
			// Get path list interactively and cache
			return this.connect()
				.then((connection) => {
					utils.trace('ProviderSFTP#list', `Getting path for ${dir}`);

					return connection.list(dir)
						.then((list) => {
							utils.trace('ProviderSFTP#list', `${list.length} item(s) found`);

							list.forEach((item) => {
								let match,
									pathName = utils.addTrailingSeperator(dir) + item.name;

								if (ignoreGlobs && ignoreGlobs.length) {
									match = micromatch([pathName], ignoreGlobs);
								}

								if (item.type !== 'd' && item.type !== '-') {
									// Ignore any file that isn't a directory or a regular file
									return;
								}

								if (!match || !match.length) {
									this.pathCache.remote.addFilePath(
										pathName,
										(item.modifyTime / 1000),
										(item.type === 'd' ? 'd' : 'f')
									);
								}
							});

							return this.pathCache.remote.getDir(dir);
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
	 * @returns {Promise<array>} Resolving to a nested array of files.
	 */
	listRecursiveFiles(dir, ignoreGlobs) {
		let counter = {
			scanned: 0,
			total: 0
		};

		return new Promise((resolve, reject) => {
			this.cacheRecursiveList(dir, counter, ignoreGlobs, () => {
				if (counter.scanned === counter.total) {
					resolve(this.pathCache.remote.getRecursiveFiles(
						dir
					));
				}
			}).catch(reject);
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

				// Increment counter scanned (which will eventually meet counter.total)
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
			})
			.catch((error) => {
				// The directory couldn't be scanned for some reason - increment anyway...
				counter.scanned += 1;

				// ... And show an error
				if (error instanceof Error) {
					channel.appendError(i18n.t(
						'dir_read_error_with_error',
						dir,
						error && error.message
					));
				} else {
					channel.appendError(i18n.t(
						'dir_read_error',
						dir,
						error && error.message
					));
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
			.then(() => (this.paths.getFileStats(this.paths.getNormalPath(local))
				.then(localStats => {
					result.local = localStats;
				})
			))
			.then(() => {
				result.remote = this.pathCache.remote.getFileByPath(
					remote
				);

				return result;
			})
			.catch((error) => {
				throw new PushError(
					i18n.t('cannot_list_directory', remoteDir, error.message)
				);
			});
	}

	/**
	 * Retrieves the contents of a private key. Will fall back to the current home
	 * folder if no path is specified.
	 * @param {string} file
	 */
	_getPrivateKey(service) {
		let keyFile, homeDir, defaultKeyFiles, a;

		keyFile = String(
			// TODO: get the right private key for gateway ProviderSFTP
			(service && service.privateKey) ||
			this.config.privateSSHKey ||
			''
		).trim();

		if (fs.existsSync(keyFile)) {
			utils.trace('ProviderSFTP#_getPrivateKey', `Key retrieved from ${keyFile}`);

			return {
				'file': keyFile,
				'contents': fs.readFileSync(keyFile, 'UTF-8')
			};
		} else if (keyFile !== '') {
			// File doesn't exist and wasn't empty
			channel.appendLocalisedError('key_file_not_found', keyFile);
			return false;
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
				service.privateKey = defaultKeyFiles[a];

				// ... Then return
				return {
					'file': defaultKeyFiles[a],
					'contents': fs.readFileSync(defaultKeyFiles[a], 'UTF-8')
				};
			}
		}
	}

	/**
	 * @param {string} file - Remote file to test.
	 * @description
	 * Retrieves the mime data from a file. Uses the `file` command on an ProviderSFTP server.
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

		if (ProviderSFTP.encodingByExtension.utf8.indexOf(ext) !== -1) {
			return 'utf8';
		}

		return 'binary';
	}

	/**
	 * Used on failure to disconnect, will attempt to ask the user for a psssword.
	 */
	requestAuthentication() {
		return vscode.window.showInputBox({
			ignoreFocusOut: true,
			password: true,
			prompt: i18n.t('sftp_enter_ssh_pass')
		});
	}

	/**
	 * Returns a "stamp" of the credentials for a client connection. Used with debugging.
	 * @param {Object} client
	 */
	credentialStamp(client) {
		return `${client.options.host}:${client.options.port}` +
			(
				client.options.username ?
					` [${client.options.username} (pw: ${(client.options.password ? 'YES' : 'NO')})]` :
					''
			) +
			(
				client.options.privateKey ? ' [KEY]' : ' [NO KEY]'
			);
	}

	/**
	 * Converts a local path to a remote path given the local `uri` Uri object.
	 * @param {uri} uri - VSCode URI to perform replacement on.
	 */
	convertUriToRemote(uri) {
		let file = this.paths.getNormalPath(uri),
			remotePath;

		remotePath = this.paths.stripTrailingSlash(this.config.service.root) +
			utils.filePathReplace(file, path.dirname(this.config.serviceFile), '');

		remotePath = (path.join(remotePath).split(path.sep)).join('/');

		return remotePath;
	}

	/**
	 * Converts a remote path to a local path given the remote `file` pathname.
	 * @param {string} remotePath - Remote path to perform replacement on.
	 * @returns {uri} A qualified Uri object.
	 */
	convertRemoteToUri(remotePath) {
		return this.paths.join(
			path.dirname(this.config.serviceFile),
			remotePath.replace(
				this.paths.stripTrailingSlash(this.config.service.root, '/') + '/', ''
			)
		);
	}
}

ProviderSFTP.description = i18n.t('sftp_class_description');

ProviderSFTP.defaults = {
	host: '',
	port: 22,
	username: '',
	password: '',
	privateKey: '',
	keyPassphrase: '',
	root: '/',
	keepaliveInterval: 3000,
	debug: false,
	fileMode: '',
	sshGateway: null
};

ProviderSFTP.required = {
	host: true,
	username: true,
	root: true
};

ProviderSFTP.gatewayDefaults = {
	host: '',
	port: 22,
	username: '',
	password: '',
	privateKey: '',
	keyPassphrase: '',
	keepaliveInterval: 3000,
	debug: false
};

ProviderSFTP.encodingByExtension = {
	'utf8': [
		'.txt', '.html', '.shtml', '.js', '.jsx', '.css', '.less', '.sass',
		'.php', '.asp', '.aspx', '.svg', '.sql', '.rb', '.py', '.log', '.sh', '.bat',
		'.pl', '.cgi', '.htaccess'
	]
};

module.exports = ProviderSFTP;
