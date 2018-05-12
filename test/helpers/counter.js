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
	 * Replace a function with a counter and an optional new function.
	 * @param {function} fn - function to replace.
	 * @param {function} [newFn] - new function to invoke (if needed).
	 * @return function - new function, with built in counter.
	 */
	replace(fn, newFn) {
		return function() {
			this._increment(this._getFnName(fn), [...arguments]);

			if (newFn) {
				return newFn.call(this, arguments);
			}
		}.bind(this);
	}

	/**
	 * Attach a counter to a function.
	 * @param {function} fn - Function to count.
	 * @param {*} bound - `this` value to bind to.
	 * @return function - passed function, with built in counter.
	 */
	count(fn, bound) {
		return function() {
 			this._increment(this._getFnName(fn), [...arguments]);

			if (typeof fn === 'function') {
				// Invoke function (bound to new binding) unless bound is false
				fn.apply((bound || undefined), arguments);
			}
		}.bind(this);
	}

	/**
	 * Returns the number of times a function was invoked.
	 * @param {string} fnName - Name of the function to test.
	 * @return numer - Number of invocations.
	 */
	getCount(fnName) {
		return (this._calls[fnName] && this._calls[fnName].length) || 0;
	}

	/**
	 * Resets all internal counters
	 */
	reset() {
		this._calls = {};
	}

	/**
	 * Return the name of a function (or just give back a string).
	 * @param {function|string} fn - Function to name (or string to return).
	 * @return string - function name.
	 */
	_getFnName(fn) {
		if (typeof fn === 'function') {
			return fn.name;
		} else if (typeof fn === 'string') {
			return fn;
		}
	}

	/**
	 * Increment a call count by storing the arguments.
	 * @param {string} fnName - Name of the function to increment.
	 * @param {array} args - Arguments passed to the function.
	 */
	_increment(fnName, args) {
		if (!this._calls[fnName]) {
			this._calls[fnName] = [];
		}

		this._calls[fnName].push(this._parseCall(args));
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