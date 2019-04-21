const Loggable = require('./loggable');

class Logger {
	constructor() {
		this._log = {};

		// Fill type objects into _log
		Object.values(Logger.types).forEach(type => (this._log[type] = {}));
	}

	/**
	 * Adds a list of Loggables to the logger state.
	 * @param {array} ids - A collection of IDs to create Loggables for.
	 */
	add(ids, type = Logger.types.METHOD) {
		ids.forEach((id) => {
			if (!this._log[type][id]) {
				this._log[type][id] = new Loggable();
			}
		});
	}

	/**
	 * Removes a single Loggable by its ID.
	 * @param {string} id - The Loggable ID.
	 */
	remove(id, type = Logger.types.METHOD) {
		delete this._log[type][id];
	}

	/**
	 * Returns an instance of loggable given an ID.
	 * @param {string} id - Loggable name.
	 * @param {number} historySize - Number of log entries to keep.
	 * @returns {Loggable}
	 */
	get(id, type = Logger.types.METHOD, historySize) {
		if (!this._log[type][id]) {
			this._log[type][id] = new Loggable(historySize);
		}

		return this._log[type][id];
	}

	/**
	 * A shortcut method for `Logger#get(xxx, Logger.types.EVENT)`
	 * @param {string} id - Loggable name.
	 * @param {number} historySize - Number of log entries to keep.
	 * @returns {Loggable}
	 */
	getEvent(id, historySize) {
		return this.get(id, Logger.types.EVENT, historySize);
	}
}

Logger.types = {
	METHOD: 0,
	EVENT: 1
};

module.exports = new Logger();
