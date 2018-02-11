const crypto = require('crypto');

let taskCount = 0;

/**
 * A single queue task
 * @param {function} fn - Function to call when the queue task is invoked.
 * @param {string} id - Task id, used for duplicate detection. Will use an incrementing ID if none
 * is supplied.
 * @param {object} data - Task metadata.
 */
class QueueTask {
	constructor(fn, id, data) {
		this._id = {
			id,
			hash: null
		};

		this._data = data || {};
		this._fn = fn;
	}

	get id() {
		if (!this._id.hash) {
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
			return undefined;
		}

		hash = crypto.createHash('sha256');

		// if (typeof id === 'undefined' || !id) {
		// 	// Assign ID
		// 	id = QueueTask.anonPrefix + taskCount;

		// 	// Increment ID
		// 	taskCount += 1;
		// }

		// Hash the ID
		hash.update(id);
		return hash.digest('hex');
	}
};

QueueTask.anonPrefix = 'anonymous-';

module.exports = QueueTask;
