const path = require('path');

const ExtendedStream = require('../ExtendedStream');
const PathCacheList = require('./PathCacheList');
const PathCacheItem = require('./PathCacheItem');

/**
 * Controls caching of a source filesystem.
 */
class PathCache {
	constructor() {
		/**
		 * Main cache.
		 * @private
		 */
		this.cache = {};
	}

	/**
	 * Creates a source container.
	 * @param {string|number} source - Source id.
	 */
	createSource(source) {
		this.cache[source] = {};
	}

	/**
	 * Creates a directory (PathCacheList instance) within a source.
	 * @param {string|number} source - Source container to use.
	 * @param {string} dir - Directory name
	 */
	createSourceDir(source, dir) {
		if (!this.cache[source]) {
			// Cache source does not exist
			this.createSource(source);
		}

		this.cache[source][dir] = new PathCacheList();
	}

	/**
	 * Adds a single file to the path cache.
	 * @param {string} source - Source name from `PathCache.source`
	 * @param {string} pathName - Full path of the file/directory.
	 * @param {number} modified - Modified date, as a Unix epoch in seconds.
	 * @param {string} type - Either 'd' for directory, or 'f' for file.
	 * @param {*} [meta] - Any extra information to store.
	 */
	addFilePath(source, pathName, modified = 0, type = 'f', meta = null) {
		const dir = path.dirname(pathName);

		if (!this.cache[source] || !this.cache[source][dir]) {
			// Dir does not exist in the source cache
			this.createSourceDir(source, dir);
		}

		this.cache[source][dir].push(new PathCacheItem(
			pathName,
			modified,
			type,
			meta
		));
	}

	/**
	 * Returns whether or not a directory is cached.
	 * @param {number} source - One of the {@link PathCache.sources} sources.
	 * @param {string} dir - Directory to test.
	 * @returns {boolean} `true` if the directory is cached.
	 */
	dirIsCached(source, dir) {
		return !!(
			(this.cache[source]) &&
			(this.cache[source][dir])
		);
	}

	/**
	 * Returns whether or not a file is cached.
	 * @param {number} source - One of the {@link PathCache.sources} sources.
	 * @param {string} file - Fully qualified path (including directory).
	 * @returns {boolean} `true` if the path exists within the cache.
	 */
	fileIsCached(source, file) {
		const dirname = path.dirname(file);

		return !!(
			this.dirIsCached(dirname) &&
			(this.cache[source][dirname].indexOf(file) !== -1)
		);
	}

	/**
	 * Retrieve the cached contents of a directory
	 * @param {number} source - One of the {@link PathCache.sources} sources.
	 * @param {string} [dir] - The directory to retrieve.
	 * @param {string} [type] - Restrict files to a specific type. ('f' file or 'd' directory).
	 * @returns {PathCacheList|array} Either a single PathCacheList list or an array
	 * of PathCacheList instances, in the case that the directory was not defined
	 */
	getDir(source, dir, type = null) {
		if (this.cache[source]) {
			if (dir) {
				if (type !== null) {
					return this.cache[source][dir].filter((item) => {
						return item.type === type;
					});
				}

				return (this.cache[source][dir] || null);
			}

			return this.cache[source];
		}

		return null;
	}

	/**
	 * Returns a nested array of files.
	 * @param {number} source - One of the {@link PathCache.sources} sources.
	 * @param {string} dir - The directory to start scanning
	 * @returns {array} A nested array of files, or null if the directory was
	 * not found or could not be read.
	 */
	getRecursiveFiles(source, dir) {
		let result = [],
			re = new RegExp('^' + dir + '($|\/)'),
			dirs, a;

		if (this.cache[source] && dir) {
			dirs = Object.keys(this.cache[source]);

			for (a = 0; a < dirs.length; a += 1) {
				if (dirs[a].match(re)) {
					result = result.concat(this.getDir(
						source,
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
	 * @param {number} source - One of {@link PathCache.sources} sources.
	 * @param {string} file - Fully qualified path (including directory).
	 * @returns {PathCacheItem|null} Either the PathCacheItem object, or `null`
	 * if no file was found.
	 */
	getFileByPath(source, file) {
		const dirname = path.dirname(file);

		if ((this.cache[source]) && (this.cache[source][dirname])) {
			return this.cache[source][dirname].getByPath(file);
		}

		return null;
	}

	clear(source, dir) {
		return new Promise((resolve) => {
			if (!source) {
				// Clear entire cache
				this.cache = {};
				this.indices = {};
			}

			if (this.cache[source]) {
				// Clear one source
				if (dir && this.cache[source][dir]) {
					this.cache[source][dir] = null;
					this.indices[source][dir] = null;
					delete this.cache[source][dir];
					delete this.indices[source][dir];
				} else if (!dir) {
					this.cache[source] = null;
					this.indices[source] = null;
					delete this.cache[source];
					delete this.indices[source];
				}
			}

			resolve();
		});
	}

	/**
	 * Extends a stream with cached data about a file.
	 * @param {Readable} stream - An existing Readable stream.
	 * @param {string|number} source - Source container.
	 * @param {string} filename - The filename to stream to/from.
	 */
	extendStream(stream, source, filename) {
		let file = this.getFileByPath(source, filename);

		if (file !== null) {
			return new ExtendedStream(
				{ read: stream },
				file,
				filename
			);
		}
	}
};

/**
 * Built in sources.
 * @property {number} REMOTE
 * @property {number} LOCAL
 */
PathCache.sources = {
	REMOTE: 0,
	LOCAL: 1
}

module.exports = PathCache;
