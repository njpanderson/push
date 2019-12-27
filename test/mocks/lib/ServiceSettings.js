const fixtures = require('../../fixtures/general');

class ServiceSettings {
	clear() { }

	mergeWithServiceSettings(uri, glob, config) {
		return config;
	}

	isSettingsFile(uri) {
		return (uri.path.match(/.push.settings.jsonc?/));
	}
}

/**
 * SFTP settings returning class
 */
class ServiceSettingsSFTP extends ServiceSettings {
	getServerJSON() {
		return fixtures.services.SFTP.serviceData;
	}

	mergeWithServiceSettings(uri, glob, config) {
		return Object.assign(
			{
				service: fixtures.services.SFTP.serviceData.data[fixtures.services.SFTP.serviceData.data.env].options
			},
			config,
			fixtures.services.SFTP.serviceData.data
		);
	}
}

module.exports = {
	sftp: ServiceSettingsSFTP
};
