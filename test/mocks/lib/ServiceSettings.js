const fixtures = require('../../fixtures/general');

class ServiceSettings {
	clear() { }
}

/**
 * SFTP settings returning class
 */
class ServiceSettingsSFTP extends ServiceSettings {
	getServerJSON() {
		return fixtures.servers.SFTP
	}
}

module.exports = {
	sftp: ServiceSettingsSFTP
};