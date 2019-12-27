const path = require('path');

const counter = require('../../helpers/counter');
const ServiceSettings = require('./ServiceSettings');
const fixtures = require('../../fixtures/general');

class Service {
	constructor() {
		this.restartServiceInstance = counter.create('Service#restartServiceInstance');
		this.settings = new ServiceSettings.sftp();
	}

	exec(method, config, args) {
		if (!this[method]) {
			throw new Error(`Method ${method} doesn't exist in mock.`);
		}

		return this[method].apply(this, args);
	}

	execSync(method, config, args) {
		if (!this[method]) {
			throw new Error(`Method ${method} doesn't exist in mock.`);
		}

		return this[method].apply(this, args);
	}

	convertUriToRemote(uri) {
		return uri;
	}

	convertRemoteToUri(uri) {
		return uri;
	}

	listRecursiveFiles(uri, ignoreGlobs) {
		switch (uri.path) {
		case fixtures.mockFolder:
		case fixtures.mockFolderWithTrailingSlash:
		case fixtures.mockFolder2:
			return Promise.resolve([
				path.join(fixtures.mockFolder, 'subfolder', 'subfile.txt'),
				path.join(fixtures.mockFolder, 'subfolder', 'subfile2.txt'),
				path.join(fixtures.mockFolder, 'subfolder', 'subfile3.txt'),
				path.join(fixtures.mockFolder, 'subfolder', 'subfile4.txt')
			]);

		default:
			throw new Error('Invalid/unknown path passed to mock listRecursiveFiles.');
		}
	}

	stop() {
		return Promise.resolve();
	}
}

module.exports = Service;
