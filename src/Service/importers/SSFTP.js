const ImporterBase = require('../../ImporterBase');

class SSFTP extends ImporterBase {
	/**
	 * Import a single file into the SFTP importer.
	 * @param {Uri} uri - Uri of file to read.
	 */
	import(uri) {
		return this.loadFile(uri)
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

			['dir_permissions', 'file_permissions'].forEach((setting) => {
				if (SSFTP.tests.fileMode.test(settings[setting])) {
					ob.SFTP = this.addArrayData(ob.SFTP, 'fileMode', {
						'glob': '**/*/',
						'mode': settings[setting]
					});
				}
			});

			resolve(ob);
		});
	}

	test(settings) {
		return (
			(settings.type && settings.type === 'sftp')
		);
	}
}

SSFTP.tests = {
	fileMode: /0?\d{3}/
};

module.exports = SSFTP;
