const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jsonc = require('jsonc-parser');

const Paths = require('../lib/Paths');

class ServiceSettings {
	constructor() {
		this.settingsCache = {};
		this.paths = new Paths();
	}

	/**
	 * Completely clear the cache by trashing the old object.
	 */
	clear() {
		this.settingsCache = {};
	}

	/**
	 * @description
	 * Attempts to retrieve a server settings JSON file from the supplied URI,
	 * eventually ascending the directory tree to the root of the project.
	 * @param {object} uri - URI of the path in which to start looking.
	 * @param {string} settingsFilename - Name of the settings file.
	 */
	getServerJSON(uri, settingsFilename) {
		let uriPath = this.paths.getNormalPath(uri),
			file, fileContents, newFile, hash, digest;

		// If the path isn't a directory, get its directory name
		if (!this.paths.isDirectory(uriPath)) {
			uriPath = path.dirname(uriPath);
		}

		// Use a cached version, if it exists
		if (this.settingsCache[uriPath]) {
			this.settingsCache[uriPath].newFile = false;
			return this.settingsCache[uriPath];
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
					hash = crypto.createHash('sha256');
					hash.update(file + '\n' + fileContents);
					digest = hash.digest('hex');

					// Check file is new by comparing existing hash
					newFile = (
						!this.settingsCache[uriPath] ||
						digest !== this.settingsCache[uriPath].hash
					);

					// Cache entry
					this.settingsCache[uriPath] = {
						file,
						fileContents,
						newFile,
						data: jsonc.parse(fileContents),
						hash: digest
					};

					return this.settingsCache[uriPath];
				} catch(e) {
					return null;
				}
			}
		}

		return null;
	}
}

module.exports = ServiceSettings;