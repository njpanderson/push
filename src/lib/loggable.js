class Loggable {
	/**
	 * Creates a Loggable instance
	 * @param {number=5} historySize - Number of log entries to keep.
	 * @returns {Loggable}
	 */
	constructor(historySize = 5) {
		this._lastRun = {
			time: 0
		};

		this.historySize = historySize;

		this.runTimes = [];
	}

	add(message) {
		this._lastRun = {
			time: Date.now(),
			message
		};

		this.runTimes.unshift(
			this._lastRun
		);

		// Keep array x long
		this.runTimes.splice(this.historySize);

		return true;
	}

	/**
	 * Determines whether or not the Loggable has run within `seconds` seconds.
	 * @param {number} seconds - Number of seconds to constrain.
	 * @param {number} time - Timestamp (`Date.now()`) (defaults to curent time).
	 * @returns {boolean} - `true` if it has, `false` otherwise.
	 */
	runWithin(seconds, time) {
		if (typeof time === 'undefined') {
			time = Date.now();
		}

		return (this._lastRun.time > (time - (seconds * 1000)));
	}

	/**
	 * Returns the last x seconds since last run (or the age).
	 */
	age() {
		if (this._lastRun.time) {
			return (Date.now() - this._lastRun.time) / 1000;
		}

		return 0;
	}

	/**
	 * Determines whther the Loggable has ever run.
	 * @returns {boolean} `true` if the Loggable has ever run before, `false` otherwise.
	 */
	hasRunOnce() {
		return (this._lastRun.time > 0);
	}

	lastRun() {
		return this._lastRun.time;
	}

	lastMessage() {
		return this._lastRun.message;
	}
}

module.exports = Loggable;
