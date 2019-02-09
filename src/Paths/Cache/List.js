const Item = require('./Item');

/**
 * A list of cached paths for a single directory.
 * @param {Item[]} [items] - An optional array of Item items.
 */
class List {
	constructor(items) {
		this.indices = {};
		this.list = [];

		if (items) {
			this.push(items);
		}
	}

	/**
	 * Push items into the cache list.
	 * @param {...Item[]} - A list of arguments defining items to insert.
	 */
	push() {
		[...arguments].forEach((arg) => {
			if (!Array.isArray(arg)) {
				arg = [arg];
			}

			arg.forEach((item) => {
				let index;

				if (!(item instanceof Item)) {
					throw new Error('item must be an instance of Item.');
				}

				if ((index = this.indices[item.pathName]) === undefined) {
					// File does not exist in the source/dir index cache
					this.indices[item.pathName] = (
						this.list.push(item)
					) - 1;
				} else {
					this.list[index] = item;
				}
			});
		});
	}

	/**
	 * @param {function} callback - Callback function to fire for each item.
	 * @description
	 * Filters items based on the return value of a callback.
	 * Works in a similar way to Array#filter.
	 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
	 */
	filter() {
		return Array.prototype.filter.apply(this.list, arguments);
	}

	/**
	 * Returns the index of a path within the list.
	 * @param {string} pathName - Fully qualified path (including directory).
	 * @returns {number} The index of the item, or `-1` if the item cannot be
	 * found.
	 */
	indexOf(pathName) {
		return (pathName in this.indices) ? this.indices[pathName] : -1;
	}

	/**
	 * Retrieves a Item from the cache by its full path name.
	 * @param {string} pathName - The path name of the file.
	 * @returns {Item|null} Either the Item representing the
	 * file, or `null` if no file was found.
	 */
	getByPath(pathName) {
		if (this.indexOf(pathName) !== -1) {
			return this.list[
				this.indices[pathName]
			];
		}

		return null;
	}

}

module.exports = List;
