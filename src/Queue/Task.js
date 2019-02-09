const crypto = require('crypto');

/**
 * A single queue task
 * @param {function} fn - Function to call when the queue task is invoked.
 * @param {string} id - Task id, used for duplicate detection. Will use an incrementing ID if none
 * is supplied.
 * @param {object} data - Task metadata.
 */
class Task {
	constructor(fn, id, data) {
		this._id = { id };

		this._data = data || {
			uriContext: null
		};
		this._fn = fn;
	}

	get id() {
		if (typeof this._id.hash === 'undefined') {
			this._id.hash = this._generateId(this._id.id);
		}

		return this._id.hash;
	}

	get data() {
		return this._data;
	}

	set data(data) {
		this._data = Object.assign({}, this._data, data);
	}

	get fn() {
		return this._fn;
	}

	_generateId(id) {
		let hash;

		if (typeof id === 'undefined' || !id) {
			return null;
		}

		hash = crypto.createHash('sha256');

		// Hash the ID
		hash.update(id);
		return hash.digest('hex');
	}
}

Task.anonPrefix = 'anonymous-';

module.exports = Task;
