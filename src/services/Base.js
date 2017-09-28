const vscode = require('vscode');
const path = require('path');

const utils = require('../lib/utils');
const Paths = require('../lib/Paths');

class ServiceBase {
	constructor() {
		this.type = '';
		this.progress = null;
		this.serviceDefaults = {};
		this.config = {};
		this.collisionOptions = {};

		this.paths = new Paths();
	}

	destructor() {
		this.config = null;
		return Promise.resolve();
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
	 * Converts a local path to a remote path given the local `uri` Uri object.
	 * @param {uri} uri - VSCode URI to perform replacement on.
	 */
	convertUriToRemote(uri) {
		let file = this.paths.getNormalPath(uri);

		return this.paths.stripTrailingSlash(this.config.service.root) + '/' +
			file.replace(path.dirname(this.config.serviceFilename) + '/', '');
	}

	/**
	 * Converts a remote path to a local path given the remote `file` pathname.
	 * @param {string} file - Remote pathname to perform replacement on.
	 * @returns {uri} A qualified Uri object.
	 */
	convertRemoteToUri(file) {
		return vscode.Uri.parse(
			path.dirname(this.config.serviceFilename) + '/' +
			file.replace(this.paths.stripTrailingSlash(this.config.service.root) + '/', '')
		);
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
		this.collisionOptions = {};
		return Promise.resolve(true);
	}

	/**
	 * Recursively create a directory path using a callback function.
	 * @param {string} dir - Directory to create. Must contain the root path.
	 * @param {string} root - Root path, for validation
	 * @param {function} fnDir - Callback function. Invoked for each new directory
	 * required during creation.
	 */
	mkDirRecursive(dir, root, fnDir) {
		let baseDir, recursiveDir, dirList;

		if (dir === root) {
			// Resolve the promise immediately as the root directory must exist
			return Promise.resolve();
		}

		if (dir.startsWith(root)) {
			baseDir = dir.replace(root + '/', '');
			recursiveDir = baseDir.split('/');
			dirList = [];

			// First, create a directory list for the Promise loop to iterate over
			recursiveDir.reduce((acc, current) => {
				let pathname = (acc === '' ? current : (acc + '/' + current));

				if (pathname !== '') {
					dirList.push(root + '/' + pathname);
				}

				return pathname;
			}, '');

			return this.mkDirByList(dirList, fnDir);
		}

		return Promise.reject('Directory is outside of root and cannot be created.');
	}

	mkDirByList(list, fnDir) {
		let dir = list.shift();

		if (dir !== undefined) {
			return fnDir(dir)
				.then(() => {
					return this.mkDirByList(list, fnDir);
				})
				.catch((error) => {
					throw error;
				});
		}

		return Promise.resolve();
	}

	/**
	 * Base service file upload method.
	 * @param {string} src - File source path
	 * @param {string} dest - File destination path
	 * @returns {promise}
	 */
	put() {
		throw new Error('Service #put method is not yet implemented!');
	}

	/**
	 * Base service file download method.
	 * @param {string} src - File source path
	 * @param {string} dest - File destination path
	 * @returns {promise}
	 */
	get() {
		throw new Error('Service #get method is not yet implemented!');
	}

	/**
	 * @param {string} dir - Directory to list.
	 * @description
	 * Base service directory listing method.
	 * Should return a promise either resolving to a list in the format given by
	 * PathCache#getDir(), or rejecting if the directory passed could not be found.
	 * @returns {promise}
	 */
	list() {
		throw new Error('Service #list method is not yet implemented!');
	}
};

module.exports = ServiceBase;