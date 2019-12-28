const path = require('path');

const List = require('./List');
const Item = require('./Item');
const utils = require('../../lib/utils');

/**
 * Controls caching of a source filesystem.
 */
class Cache {
	constructor(id) {
		/**
		 * Main cache.
		 * @private
		 */
		this.id = id;
		this.cache = {};
	}

	/**
	 * Creates a directory (List instance).
	 * @param {string} dir - Directory name
	 */
	createDir(dir) {
		this.cache[dir] = new List();
	}

	/**
	 * Adds a single file to the path cache.
	 * @param {string} pathName - Full path of the file/directory.
	 * @param {number} modified - Modified date, as a Unix epoch in seconds.
	 * @param {string} type - Either 'd' for directory, or 'f' for file.
	 * @param {*} [meta] - Any extra information to store.
	 */
	addFilePath(pathName, modified = 0, type = 'f', meta = null) {
		const dir = path.dirname(pathName);

		utils.trace(
			`Cache#addFilePath(${this.id})`,
			`Caching file ${pathName}`
		);

		if (!this.cache[dir]) {
			utils.trace(
				`Cache#addFilePath(${this.id})`,
				`Creating dir ${dir}`
			);

			// Dir does not exist in the source cache
			this.createDir(dir);
		}

		this.cache[dir].push(new Item(
			pathName,
			modified,
			type,
			meta
		));
	}

	/**
	 * Returns whether or not a directory is cached.
	 * @param {string} dir - Directory to test.
	 * @returns {boolean} `true` if the directory is cached.
	 */
	dirIsCached(dir) {
		const cached = !!(this.cache[dir]);

		utils.trace(
			`Cache#dirIsCached(${this.id})`,
			`Dir "${dir}" is ${cached ? 'cached' : 'not cached'}`
		);

		return cached;
	}

	/**
	 * Returns whether or not a file is cached.
	 * @param {string} file - Fully qualified path (including directory).
	 * @returns {boolean} `true` if the path exists within the cache.
	 */
	fileIsCached(file) {
		const dirname = path.dirname(file);

		return !!(
			this.dirIsCached(dirname) &&
			(this.cache[dirname].indexOf(file) !== -1)
		);
	}

	/**
	 * Retrieve the cached contents of a directory
	 * @param {string} [dir] - The directory to retrieve.
	 * @param {string} [type] - Restrict files to a specific type. ('f' file or 'd' directory).
	 * @returns {List|array} Either a single List list or an array
	 * of List instances, in the case that the directory was not defined
	 */
	getDir(dir, type = null) {
		if (dir) {
			if (this.cache[dir]) {
				if (type !== null) {
					return this.cache[dir].filter((item) => {
						return item.type === type;
					});
				}

				return (this.cache[dir].list || null);
			}

			return null;
		}

		return this.cache;
	}

	/**
	 * Returns a nested array of files.
	 * @param {string} dir - The directory to start scanning
	 * @returns {array} A nested array of files, or null if the directory was
	 * not found or could not be read.
	 */
	getRecursiveFiles(dir) {
		let result = [],
			re = new RegExp('^' + dir + '($|\\/)'),
			dirs, a;

		if (this.cache && dir) {
			dirs = Object.keys(this.cache);

			for (a = 0; a < dirs.length; a += 1) {
				if (dirs[a].match(re)) {
					result = result.concat(this.getDir(
						dirs[a],
						'f'
					));
				}
			}

			return result;
		}

		return null;
	}

	/**
	 * Retrieves a file from the cache by its full path name.
	 * @param {string} file - Fully qualified path (including directory).
	 * @returns {Item|null} Either the Item object, or `null`
	 * if no file was found.
	 */
	getFileByPath(file) {
		const dirname = path.dirname(file);

		if ((this.cache) && (this.cache[dirname])) {
			return this.cache[dirname].getByPath(file);
		}

		return null;
	}

	/**
	 * Clear a cached directory, or the entire cache.
	 * @param {string} [dir] - The optional directory to clear.
	 */
	clear(dir) {
		return new Promise((resolve) => {
			if (typeof dir === 'undefined') {
				// Clear entire cache
				utils.trace(`Cache#clear(${this.id})`, 'Clearing all caches');
				this.cache = {};
				return resolve();
			}

			if (this.cache[dir]) {
				// Clear one directory
				utils.trace(
					`Cache#clear(${this.id})`,
					`Clearing caches for "${dir}"`
				);

				this.cache[dir] = null;
				delete this.cache[dir];
			}

			return resolve();
		});
	}
}

module.exports = Cache;
