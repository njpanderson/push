const vscode = require('vscode');
const path = require('path');

const utils = require('../lib/utils');
const Paths = require('../lib/Paths');
const channel = require('../lib/channel');

class ServiceBase {
	constructor(options) {
		this.setOptions(options);

		this.type = '';
		this.queueLength = 0;
		this.progress = null;
		this.serviceDefaults = {};
		this.config = {};
		this.persistCollisionOptions = {};
		this.channel = channel;

		this.paths = new Paths();
	}

	destructor() {
		this.config = null;
	}

	/**
	 * Sets the current service progress.
	 * @param {boolean|string} state - Use `false` to cancel the queue, or a string
	 * value to specify the current state.
	 */
	setProgress(state) {
		this.progress = state || null;
	}

	setOptions(options) {
		this.options = Object.assign({}, {
			onDisconnect: null,
			onConnect: null
		}, options);
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
					channel.appendError(
						utils.strings.SERVICE_SETTING_MISSING,
						this.type,
						key
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

		file = this.paths.stripTrailingSlash(this.config.service.root) +
			file.replace(path.dirname(this.config.serviceFilename), '');

		file = (path.join(file).split(path.sep)).join('/');

		return file;
	}

	/**
	 * Converts a remote path to a local path given the remote `file` pathname.
	 * @param {string} file - Remote pathname to perform replacement on.
	 * @returns {uri} A qualified Uri object.
	 */
	convertRemoteToUri(file) {
		return vscode.Uri.file(
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
		let indexOfDot = file.indexOf('.'),
			re, matches;

		if (indexOfDot > 0 || indexOfDot === -1) {
			re = new RegExp('^' + file.substring(0, indexOfDot) + '(-\d+)?\..*');
		} else {
			re = new RegExp('^' + file + '(-\d+)?');
		}

		matches = this.matchFilesInDir(dirContents, re);

		if (matches.length > 0) {
			if (indexOfDot > 0) {
				// filename[-XXX].ext
				return file.substring(0, (indexOfDot)) +
					'-' + (matches.length + 1) + file.substring(indexOfDot);
			} else {
				// .ext[-XXX]
				return file.substring(indexOfDot) + '-' + (matches.length + 1);
			}
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
	init(queueLength) {
		this.persistCollisionOptions = {};
		this.queueLength = queueLength;
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
			baseDir = utils.trimSeparators(dir.replace(root, ''));
			recursiveDir = baseDir.split('/');
			dirList = [];

			// First, create a directory list for the Promise loop to iterate over
			recursiveDir.reduce((acc, current) => {
				let pathname = (acc === '' ? current : (acc + '/' + current));

				if (pathname !== '') {
					dirList.push(
						utils.addTrailingSeperator(root) + pathname
					);
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
	 * Checks for a potential file collision between the `dest` and
	 * `source` objects. Will display a collision picker if this occurs.
	 * @param {object} source - Source filecache entry.
	 * @param {object} dest - Destination filecache entry (the item to be replaced).
	 * @param {string} defaultCollisionOption - One of the utils.collisionOpts
	 * collision actions.
	 */
	checkCollision(source, dest, defaultCollisionOption) {
		let collisionType, timediff;

		// Dest file exists - get time difference
		if (dest) {
			timediff = (
				source.modified -
				(dest.modified + this.config.service.timeZoneOffset)
			);
		}

		if (dest &&
			(
				(this.config.service.testCollisionTimeDiffs && timediff < 0) ||
				!this.config.service.testCollisionTimeDiffs
			)) {
			// Destination file exists and difference means source file is older
			if (dest.type === source.type) {
				collisionType = 'normal';

				if (this.persistCollisionOptions[collisionType]) {
					// Persisting collision option (defined by an "all" request)
					return {
						type: collisionType,
						option: this.persistCollisionOptions[collisionType]
					};
				} else if (
					defaultCollisionOption &&
					utils.collisionOpts[defaultCollisionOption]
				) {
					// Default collision option (defined in settings file)
					return {
						type: collisionType,
						option: utils.collisionOpts[defaultCollisionOption]
					};
				} else {
					// Standard collision picker
					return utils.showFileCollisionPicker(
						source.name,
						this.persistCollisionOptions.normal,
						this.queueLength
					);
				}
			} else {
				return utils.showMismatchCollisionPicker(
					source.name
				);
			}
		}

		return false;
	}

	setCollisionOption(result) {
		if (result.option && result.option.baseOption) {
			// Save collision options from "All" option
			this.persistCollisionOptions[result.type] = result.option.baseOption;
			result.option = result.option.baseOption;
		}
	}

	/**
	 * Base service file upload method.
	 * @param {string} src - File source path
	 * @param {string} dest - File destination path
	 * @param {string} [collisionAction] - What to do on file collision. Use one
	 * of the utils.collisionOpts collision actions.
	 * @returns {promise}
	 */
	put() {
		throw new Error('Service #put method is not yet implemented!');
	}

	/**
	 * Base service file download method.
	 * @param {string} src - File source path
	 * @param {string} dest - File destination path
	 * @param {string} [collisionAction] - What to do on file collision. Use one
	 * of the utils.collisionOpts collision actions.
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
	 * {@link PathCache#getDir}, or rejecting if the directory passed could not be found.
	 * @returns {promise}
	 */
	list() {
		throw new Error('Service #list method is not yet implemented!');
	}

	/**
	 * Base service stop function. Implementation is optional.
	 *
	 * Used to ensure that an existing transfer is halted.
	 */
	stop() {
		this.setProgress(false);
		return Promise.resolve();
	}

	/**
	 * Base service disconnect function. Implementation is optional, but it may
	 * be used in the future for preventing hanging connections over time.
	 *
	 * It is the responsibility of the service implementation to ensure all its
	 * active connections are removed.
	 */
	disconnect() {}

	/**
	 * @description
	 * Base service process connection callback. Used by Base options.
	 * Can be extended, ensuring that `super.onConnect()` is called.
	 */
	onConnect() {
		if (typeof this.options.onConnect === 'function') {
			this.options.onConnect(this);
		}
	}

	/**
	 * @param {boolean} hadError - Set `true` If an error occured.
	 * @description
	 * Base service process disconnection callback. Used by Base options.
	 * Can be extended, ensuring that `super.onDisconnect()` is called.
	 *
	 * If `hadError` is `true`, the Push log window will be invoked to show
	 * the user which error occured.
	 */
	onDisconnect(hadError) {
		this.setProgress(false);

		// Alert user via channel
		channel['append' + (hadError ? 'Error' : 'Info')](
			`Service "${this.type}" has disconnected.`
		);

		if (typeof this.options.onDisconnect === 'function') {
			this.options.onDisconnect(this);
		}
	}

	/**
	 * @param {string} dir - Directory to list.
	 * @param {string} ignoreGlobs - List of globs to ignore. Files matching these
	 * globs should not be returned.
	 * @description
	 * Base service recursive file listing method.
	 * Should return a promise either resolving to a list in the format given by
	 * {@link PathCache#getRecursiveFiles}, or rejecting if the directory passed
	 * could not be found.
	 * @returns {promise}
	 */
	listRecursiveFiles() {
		throw new Error('Service #listRecursiveFiles method is not yet implemented!');
	}
};

module.exports = ServiceBase;