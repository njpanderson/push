const SFTPClient = require('ssh2-sftp-client');
const fs = require('fs');
const path = require('path');

const ServiceBase = require('./Base');
const Paths = require('../lib/Paths');

class ServiceSFTP extends ServiceBase {
	constructor() {
		super();

		this.type = 'SFTP';
		this.client = null;

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
		if (this.client) {
			this.client.end();
			this.client = null;
		}
	}

	connect() {
		let options = {
			host: this.config.service.host,
			port: this.config.service.port,
			username: this.config.service.username,
			privateKey: this._getPrivateKey(this.config.service.privateKey || this.config.privateKey)
		};

		if (this.config.service.password) {
			options.password = this.config.service.password;
		}

		if (!this.client) {
			this.client = new SFTPClient();

			return this.client.connect(options)
				.then(() => {
					console.log(`SFTP client connected to host ${options.host}:${options.port}`);
				})
				.catch((error) => {
					this.showError(error)
				});
		} else {
			return Promise.resolve(this.client);
		}
	}

	put(src) {
		let dest = this.paths.replaceWorkspaceWithRoot(src, this.config.service.root);
		console.log(`put ${src}`);
		this.progress = 'Uploading a file...';

		return this.connect().then(() => {
			console.log('Connected!');
			return this.mkDir(path.dirname(dest), true)
		})
		.then(() => {
			console.log(`Putting ${src} to ${dest}...`);
			return this.client.put(src, dest);
		})
		.then(() => {
			console.log('Uploaded!');
			this.progress = null;
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
		return this.client.mkdir(dest, recursive);
	}

	_getPrivateKey(file) {
		if (fs.existsSync(file)) {
			return fs.readFileSync(file, 'UTF-8');
		}
	}
};

module.exports = ServiceSFTP;