const fixtures = require('../../fixtures/general');

class ServiceSettings {
	clear() { }

	mergeWithServiceSettings(uri, glob, config) {
		return config;
	}
}

/**
 * SFTP settings returning class
 */
class ServiceSettingsSFTP extends ServiceSettings {
	getServerJSON() {
		return fixtures.servers.SFTP
	}

	mergeWithServiceSettings(uri, glob, config) {
		return Object.assign({}, config, fixtures.servers.SFTP.data);
	}
}

module.exports = {
	sftp: ServiceSettingsSFTP
};
