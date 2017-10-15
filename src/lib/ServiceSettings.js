const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const Paths = require('../lib/Paths');

class ServiceSettings {
	constructor() {
		this.settingsCache = {};
		this.paths = new Paths();
	}

	/**
	 * @description
	 * Attempts to retrieve a server settings JSON file from the supplied URI,
	 * eventually ascending the directory tree to the root of the project.
	 * @param {object} uri - URI of the path in which to start looking.
	 * @param {string} settingsFilename - Name of the settings file.
	 */
	getServerJSON(uri, settingsFilename) {
		const hash = crypto.createHash('sha256');

		let uriPath = this.paths.getNormalPath(uri),
			file, fileContents, newFile;

		// TODO: Find next existing directory up the tree when passed a non-existent directory
		// uriPath = this.paths.getClosestDirectory(uriPath);

		// If the path isn't a directory, get its directory name
		if (!this.paths.isDirectory(uriPath)) {
			uriPath = path.dirname(uriPath);
		}

		// Find the settings file
		file = this.paths.findFileInAncestors(
			settingsFilename,
			uriPath
		);

		if (file !== '' && fs.existsSync(file)) {
			// File isn't empty and exists - read and set into cache
			fileContents = (fs.readFileSync(file, "UTF-8")).toString().trim();

			if (fileContents !== '') {
				try {
					newFile = (
						!this.settingsCache ||
						fileContents !== this.settingsCache
					);

					this.settingsCache = fileContents;

					hash.update(file + '\n' + fileContents);

					return {
						file,
						data: JSON.parse(fileContents),
						newFile,
						hash: hash.digest('hex')
					};
				} catch(e) {
					return null;
				}
			}
		}
	}
}

module.exports = ServiceSettings;