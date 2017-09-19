const path = require('path');

class PathCache {
	constructor() {
		// Path cache
		this.cache = {};
		this.indices = {};
	}

	createSource(source) {
		this.cache[source] = {};
		this.indices[source] = {};
	}

	createSourceDir(source, dir) {
		if (!this.cache[source]) {
			// Cache source does not exist
			this.createSource(source);
		}

		this.cache[source][dir] = [];
		this.indices[source][dir] = {};
	}

	/**
	 *	Adds a single file to the path cache.
	 * @param {string} source - Source name from `PathCache.source`
	 * @param {string} name - Name of the file/directory.
	 * @param {number} modified - Modified date, as a Unix epoch in seconds.
	 * @param {string} type - Either 'd' for directory, or 'f' for file.
	 * @param {*} [meta] - Any extra information to store.
	 */
	addCachedFile(source, name, modified = 0, type = 'f', meta = null) {
		const dir = path.dirname(name),
			basename = path.basename(name);

		let index;

		if (!this.cache[source] || !this.cache[source][dir]) {
			// Dir does not exist in the source cache
			this.createSourceDir(source, dir);
		}

		if ((index = this.indices[source][dir][name]) === undefined) {
			// File does not exist in the source/dir index cache
			index = (this.cache[source][dir].push({
				name: basename,
				modified,
				type,
				meta
			})) - 1;

			this.indices[source][dir][name] = index;
		} else {
			this.cache[source][dir][index] = {
				name: basename,
				modified,
				type,
				meta
			};
		}
	}

	dirIsCached(source, dir) {
		return !!(
			(this.cache[source]) &&
			(this.cache[source][dir])
		);
	}

	/**
	 * Returns whether a file or directory is cached or not.
	 * @param {number} source - One of {@link PathCache.sources} sources.
	 * @param {string} file - Fully qualified path (including directory).
	 * @returns {boolean} - `true` if the path exists within the cache, `false` otherwise.
	 */
	filenameIsCached(source, file) {
		const dirname = path.dirname(file);

		return !!(
			(this.indices[source]) &&
			(this.indices[source][dirname]) &&
			(file in this.indices[source][dirname])
		);
	}

	getDir(source, dir) {
		if (this.cache[source]) {
			if (dir) {
				return (this.cache[source][dir] || null);
			}

			return this.cache[source];
		}

		return null;
	}

	/**
	 * Retrieves a file from the cache by its full path name.
	 * @param {number} source - One of {@link PathCache.sources} sources.
	 * @param {*} file - Fully qualified path (including directory).
	 * @returns {*} Either the file object, or `null` if no file was found.
	 */
	getFileByPath(source, file) {
		const dirname = path.dirname(file);

		if (this.filenameIsCached(source, file)) {
			return this.cache[source][dirname][
				this.indices[source][dirname][file]
			];
		}

		return null;
	}

	clear(source, dir) {
		if (!source) {
			// Clear entire cache
			this.cache = {};
		}

		if (this.cache[source]) {
			// Clear one source
			if (dir && this.cache[source][dir]) {
				this.cache[source][dir] = null;
				delete this.cache[source][dir];
			} else if (!dir) {
				this.cache[source] = null;
				delete this.cache[source];
			}
		}
	}
};

PathCache.sources = {
	REMOTE: 0,
	LOCAL: 1
}

module.exports = PathCache;