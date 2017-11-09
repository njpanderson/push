const BaseImporter = require('./BaseImporter');

class SSFTP extends BaseImporter {
	import(pathName) {
		return this.loadFile(pathName)
			.then(
				(buffer) => this.translate(this.parseJSON(buffer.toString('utf8')))
			);
	}

	translate(settings) {
		return new Promise((resolve, reject) => {
			let ob;

			if (!this.test(settings)) {
				reject('Settings format is either incorrect or not of type "SFTP".');
				return;
			}

			ob = {
				service: 'SFTP',
				SFTP: {
					host: settings.host,
					username: settings.user,
					password: settings.password,
					root: settings.remote_path,
				}
			};

			if (settings.ssh_key_file) {
				ob.SFTP.privateKey = settings.ssh_key_file;
			}

			if (settings.confirm_overwrite_newer === false) {
				ob.SFTP.collisionUploadAction = 'overwrite';
			}

			if (settings.confirm_downloads === false) {
				ob.SFTP.collisionDownloadAction = 'overwrite';
			}

			resolve(ob);
		});
	}

	test(settings) {
		return (
			(settings.type && settings.type === 'sftp')
		);
	}
}

module.exports = SSFTP;