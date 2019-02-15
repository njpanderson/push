const fs = require('fs');

const Cache = require('./Cache');
const paths = require('../lib/paths');

/**
 * Provides cacheable path method.
 */
class PathCache {
	/**
	 * Returns a current or new instance of Cache.
	 * @returns {Cache} An instance of Cache.
	 */
	getCache() {
		if (!this.pathCache) {
			this.pathCache = new Cache();
		}

		return this.pathCache;
	}

	/**
	 * List the contents of a single filesystem-accessible directory.
	 * @param {string} dir - Directory to list.
	 * @param {Cache} [cache] - Cache instance. Will use an internal instance
	 * if not specified.
	 * @description
	 * An existing `cache` instance (of Cache) may be supplied. Otherwise,
	 * a generic cache instance is created.
	 * @returns {Promise<CacheList>} A promise resolving to a directory list.
	 */
	listDirectory(dir, cache) {
		dir = paths.stripTrailingSlash(dir);

		// Use supplied cache or fall back to class instance
		cache = cache || this.getCache();

		if (cache.dirIsCached(dir)) {
			return Promise.resolve(cache.getDir(dir));
		} else {
			return new Promise((resolve, reject) => {
				fs.readdir(dir, (error, list) => {
					if (error) {
						return reject(error);
					}

					list.forEach((filename) => {
						const pathname = dir + paths.sep + filename,
							stats = fs.statSync(pathname);

						cache.addFilePath(
							pathname,
							stats.mtime.getTime() / 1000,
							stats.isDirectory() ? 'd' : 'f'
						);
					});

					resolve(cache.getDir(dir));
				});
			});
		}
	}
}

module.exports = PathCache;
