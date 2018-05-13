/**
 * Counter class for keeping track of function calls and their arguments.
 */
class Counter {
	/**
	 * Class constructor
	 */
	constructor() {
		this._calls = {};
	}

	/**
	 * Bind a counter to an ID, returning an empty function
	 * @param {string} id
	 */
	bind(id) {
		return function() {
			this._increment(id, [...arguments]);
		}.bind(this);
	}

	/**
	 * Replace a function with a counter and a new function.
	 * @param {string} id - function name/namespace.
	 * @param {function} fn - function to replace.
	 * @param {function} [newFn] - new function to invoke (if needed).
	 * @return function - new function, with built in counter.
	 */
	replace(id, fn, newFn) {
		if (typeof fn !== 'function') {
			throw new Error('fn must be a function object.');
		}

		if (typeof newFn !== 'function') {
			throw new Error('newFn must be a function object.');
		}

		return function() {
			this._increment(id, [...arguments]);

			if (newFn) {
				return newFn.call(this, arguments);
			}
		}.bind(this);
	}

	/**
	 * Attach a counter to a function.
	 * @param {string} fn - Function name/namespace.
	 * @param {function} fn - Function to count.
	 * @param {*} bound - `this` value to bind to.
	 * @return function - passed function, with built in counter.
	 */
	count(id, fn, bound) {
		return function() {
 			this._increment(id, [...arguments]);

			if (typeof fn === 'function') {
				// Invoke function (bound to new binding) unless bound is false
				return fn.apply((bound || undefined), arguments);
			}
		}.bind(this);
	}

	/**
	 * Returns the number of times a function was invoked.
	 * @param {string} id - ID of the function to test.
	 * @return numer - Number of invocations.
	 */
	getCount(id) {
		return (this._calls[id] && this._calls[id].length) || 0;
	}

	/**
	 * Returns the number of times a function was invoked.
	 * @param {string} id - ID of the function to test.
	 * @param {number} [invocation=1] - 1-based invocation index.
	 * @param {number} [index] - 0-based argument index.
	 * @return numer - Number of invocations.
	 */
	getArgs(id, invocation = 1, index) {
		let invoked;

		if (
			this._calls[id] &&
			(invoked = this._calls[id][invocation - 1])
		) {
			return (invoked.length > index) ? invoked[index] : undefined;
		}

		return undefined;
	}

	/**
	 * Resets all internal counters
	 */
	reset() {
		this._calls = {};
	}

	/**
	 * Increment a call count by storing the arguments.
	 * @param {string} id - Name of the function to increment.
	 * @param {array} args - Arguments passed to the function.
	 */
	_increment(id, args) {
		if (!this._calls[id]) {
			this._calls[id] = [];
		}

		this._calls[id].push(this._parseCall(args));
	}

	/**
	 * Parse an array of arguments and duplicate any arrays or objects found within it.
	 * @param {array} args - array (not arguments) of arguments to parse.
	 * @return array - A duplicate of the array, with duplicated entries.
	 */
	_parseCall(args) {
		return args.map((item) => {
			if (Array.isArray(item)) {
				return Object.assign([], item);
			} else if (typeof item === 'object') {
				return Object.assign({}, item);
			} else {
				return item;
			}
		});
	}
}

// Export a cached instance of Counter to be shared across modules
module.exports = (new Counter());
