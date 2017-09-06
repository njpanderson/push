const SFTPClient = require('ssh2-sftp-client');

const ServiceBase = require('./Base');
const Paths = require('../lib/Paths');

class ServiceSFTP extends ServiceBase {
	constructor(config, settings) {
		super(config);

		this.type = 'SFTP';

		settings = Object.assign({}, {
			host: '',
			port: '22',
			username: '',
			password: '',
			privateKey: '',
			root: '/'
		}, settings);

		if (
			this.validateServiceSettings({
				host: true,
				port: true,
				username: true,
				root: true
			}, settings)
		) {
			this.settings = settings;
			this.paths = new Paths();
			this.client = new SFTPClient();
			this.connect();
		}
	}

	connect() {
		let options = {
			host: this.settings.host,
			port: this.settings.port,
			username: this.settings.username,
			password: this.settings.password,
			privateKey: this.settings.privateKey || this.config.privateKey
		};

		console.log(this.settings.host, this.settings.username);
		return;

		this.client.connect(options).then(() => {
			console.log(this.client.list(this.settings.root));
		}).then((data) => {
			console.log(data, 'the data info');
		}).catch((err) => {
			console.error(err, 'catch error');
		});
	}

	put(src) {
		if (this.settings) {
			console.log('SFTP#put', this.settings.host, this.settings.username);
			console.log(src, this.paths.replaceWorkspaceWithRoot(src, this.settings.root));
		}
	}
};

module.exports = ServiceSFTP;