const SFTPClient = require('ssh2-sftp-client');
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const ServiceBase = require('./Base');
const Paths = require('../lib/Paths');

class ServiceSFTP extends ServiceBase {
	constructor(config, settings) {
		super(config);

		this.type = 'SFTP';
		this.client = null;

		settings = Object.assign({}, {
			host: '',
			port: 22,
			username: '',
			password: '',
			privateKey: '',
			root: '/'
		}, settings);

		if (
			this.validateServiceSettings({
				host: true,
				username: true,
				root: true
			}, settings)
		) {
			this.settings = settings;
			this.paths = new Paths();
		}
	}

	connect() {
		let options = {
			host: this.settings.host,
			port: this.settings.port,
			username: this.settings.username,
			privateKey: this.getPrivateKey(this.settings.privateKey || this.config.privateKey)
		};

		if (this.settings.password) {
			options.password = this.settings.password;
		}

		console.log(options);

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
		let dest = this.paths.replaceWorkspaceWithRoot(src, this.settings.root);
		console.log(`put ${src}`);
		this.progress = 'Uploading a file...';

		// vscode.window.withProgress({
		// 	location: vscode.ProgressLocation.Window,
		// 	title: 'Uploading'
		// }, (progress) => {
		// 	return new Promise((resolve) => {
		// 		setTimeout(() => {
		// 			progress.report({ message: 50 });
		// 			console.log('step1');
		// 		}, 3000);

		// 		setTimeout(() => {
		// 			progress.report({ message: 75 });
		// 			console.log('step2');
		// 		}, 6000);

		// 		setTimeout(() => {
		// 			console.log('step3');
		// 			resolve();
		// 		}, 9000);
		// 	});
		// });

		return this.connect().then(() => {
			return this.mkDir(path.dirname(dest), true)
		})
		.then(() => {
			return this.client.put(src, dest)
		})
		.then(() => {
			console.log('uploaded?');
			this.progress = null;
		})
		.catch((error) => {
			this.showError(error);
		});
	}

	get(src) {
		return true;
	}

	mkDir(dest, recursive = false) {
		return this.client.mkdir(dest, recursive);
	}

	getPrivateKey(file) {
		if (fs.existsSync(file)) {
			return fs.readFileSync(file, 'UTF-8');
		}
	}
};

module.exports = ServiceSFTP;