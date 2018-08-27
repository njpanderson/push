/**
 * @description
 * Push specific errors. Contain human readable (and user legible) errors only.
 * For other error types (e.g. unexpected runtime errors) use the Error base.
 */
class PushError extends Error {
	constructor(message = '') {
		super();

		this.name = 'PushError';
		this.message = message;
	}
}

module.exports = PushError;
