const path = require('path');

const Paths = require('../lib/Paths');

class ServiceBase {
	constructor() {
		this.type = '';
		this.progress = null;
		this.serviceDefaults = {};
		this.config = {};

		this.paths = new Paths();
	}

	destructor() {
		this.config = null;
	}

	setProgress(state) {
		this.progress = state || null;
	}

	/**
	 * Sets the current configuration for the service, merging the defaults with it if set.
	 * @param {object} config
	 */
	setConfig(config) {
		this.config = config;

		if (this.config.service) {
			// Merge service specific default options
			this.config.service = this.mergeWithDefaults(
				this.config.service
			);
		}
	}

	/**
	 * Merges the service specific default settings with supplied object
	 * @param {object} settings
	 */
	mergeWithDefaults(settings) {
		return Object.assign({}, this.serviceDefaults, settings);
	}

	/**
	 * Validates the supplied `settings` object against `spec` specification.
	 * @param {object} spec - Settings specification.
	 * @param {*} settings - Settings to be validated.
	 * @returns {boolean} `true` if the settings are valid, `false` otherwise.
	 */
	validateServiceSettings(spec, settings) {
		let key;

		for (key in spec) {
			if (spec.hasOwnProperty(key)) {
				if (!settings[key]) {
					utils.showError(
						`Service setting file for type ${this.type} missing required setting: "${key}".` +
						` Please resolve before continuing.`
					);
					return false;
				}
			}
		}

		return true;
	}

	/**
	 * Converts a local path to a remote path given the local `file` filename.
	 * @param {string} file - File/directory to perform replacement on.
	 */
	convertLocalToRemote(file) {
		return this.paths.stripTrailingSlash(this.config.service.root) + '/' +
			file.replace(path.dirname(this.config.serviceFilename) + '/', '');
	}

	/**
	 * Converts a local path to a remote path given the local `file` filename.
	 * @param {string} file - File/directory to perform replacement on.
	 */
	convertRemoteToLocal(file) {
		return path.dirname(this.config.serviceFilename) + '/' +
			file.replace(this.paths.stripTrailingSlash(this.config.service.root) + '/', '');
	}

	/**
	 * Returns a filename, guarnteeing that it will not be the same as any others within
	 * the supplied file list.
	 * @param {string} file - Filename to rename
	 * @param {array} dirContents - Array of filenames in the file's directory as
	 * returned from PathCache.
	 */
	getNonCollidingName(file, dirContents) {
		let re = new RegExp('^' + file.substring(0, file.indexOf('.')) + '.*'),
			matches = this.matchFilesInDir(dirContents, re);

		if (matches.length > 0) {
			return file.substring(0, (file.indexOf('.'))) +
				'-' + (matches.length + 1) + file.substring(file.indexOf('.'));
		} else {
			return file;
		}
	}

	/**
	 * Matches the files in a directory given a regular expression.
	 * @param {array} dirContents - Contents of the directory given by pathCache.
	 * @param {*} re - Regular expression used to match.
	 * @return {object|null} Either the matches as a regular expression result, or `null`.
	 */
	matchFilesInDir(dirContents, re) {
		return dirContents.filter((item) => {
			return (item.name.match(re) !== null);
		});
	}

	/**
	 * Run intial tasks - executed once before a subsequent commands in a new queue.
	 */
	init() {
		console.log('Base service init (empty)');
		return Promise.resolve(true);
	}

	/**
	 * Base service file upload method.
	 * @param {string} src - File source path
	 * @param {string} dest - File destination path
	 */
	put() {
		throw new Error('Service #put method is not yet defined.');
	}

	/**
	 * Base service file download method.
	 * @param {string} src - File source path
	 * @param {string} dest - File destination path
	 */
	get() {
		throw new Error('Service #get method is not yet defined.');
	}
};

module.exports = ServiceBase;