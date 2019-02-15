const path = require('path');

/**
 * A single path cache item.
 * @param {string} pathName - The fully qualified path name.
 * @param {number} modified - The modification UNIX timestamp.
 * @param {string} [type='f'] - Either 'f' for file, or 'd' for directory.
 * @param {*} [meta] - Any optional meta information.
 */
class Item {
	constructor(pathName, modified, type = 'f', meta) {
		this.name = path.basename(pathName);
		this.pathName = pathName;
		this.modified = modified;
		this.type = type;
		this.meta = meta;
	}
}

module.exports = Item;
