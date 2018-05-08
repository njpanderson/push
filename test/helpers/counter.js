class Counter {
	constructor() {
		this.callCounts = {};
	}

	count(fn, bound) {
		return function() {
			if (!this.callCounts[fn.name]) {
				this.callCounts[fn.name] = 0;
			}

			this.callCounts[fn.name] += 1;

			if (bound !== false) {
				// Invoke function (bound to new binding) unless bound is false
				fn.apply((bound || null), arguments);
			}
		}.bind();
	}

	getCount(fnName) {
		return this.callCounts[fnName] || 0;
	}
}

module.exports = (new Counter());