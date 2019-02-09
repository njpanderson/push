const Configurable = require('./Configurable');
const Paths = require('./Paths');
const PushError = require('./lib/types/PushError');
const channel = require('./lib/channel');

class PushBase extends Configurable {
	constructor() {
		super();

		this.paths = new Paths();
		this.timers = {};
	}

	/**
	 * Catches (and potentially throws) general errors.
	 * @param {Error} error - Any object, inheriting from Error.
	 */
	catchError(error) {
		if (error instanceof PushError) {
			// This is an expected exception, generated for user display.
			channel.appendError(error);
		} else if (typeof error !== 'undefined') {
			// This is an unexpected or uncaught exception.
			console.error(error);
			throw error;
		}
	}

	/**
	 * Converts a function to a rate-limited version of itself.
	 * @param {string} id
	 * @param {number} timeout
	 * @param {function} fn
	 * @param {*} context
	 * @see PushBase#setTimedExecution
	 */
	rateLimit(id, timeout, fn, context = null) {
		// Arguments supplied to new function will be used for eventual execution
		return function() {
			this.setTimedExecution.apply(this, [
				id,
				timeout,
				fn,
				context
			].concat([...arguments]));
		}.bind(context);
	}

	/**
	 * @param {string} id - Identifier.
	 * @param {number} timeout - Timeout, in milliseconds.
	 * @param {function} fn - Function to call.
	 * @param {*} context - Context to apply to the function, if necessary.
	 * @param {...*} mixed - Arguments to provide to the function
	 * @description
	 * Will call the provided function within the provided context after `timeout`
	 * milliseconds. If called again with the same `id` before `timeout` has elapsed,
	 * the original request is cancelled and a new one is made.
	 * @returns {number} Timer id.
	 */
	setTimedExecution(id, timeout, fn, context = null) {
		let args = [];

		// Clear any previously set timers with this id
		this.clearTimedExecution(id);

		if (arguments.length > 4) {
			// Add arguments for calling
			args = [...arguments].slice(4);
		}

		// Set a timer
		this.timers[id] = setTimeout(() => {
			// Call function with context and arguments
			fn.apply(context, args);
		}, timeout);

		return this.timers[id];
	}

	/**
	 * Clears a previous set timed execution.
	 * @param {string} id - Identifier, as passed to {@link PushBase#setTimedExecution}.
	 */
	clearTimedExecution(id) {
		if (this.timers[id]) {
			// Clear timer and delete the timer id
			clearTimeout(this.timers[id]);
			delete this.timers[id];
		}
	}
}

module.exports = PushBase;
