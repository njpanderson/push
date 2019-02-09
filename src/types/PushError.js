/**
 * @description
 * Push specific errors. Contain human readable (and user legible) errors only.
 * For other error types (e.g. unexpected runtime errors) use the Error base.
 * @implements Error
 */
class PushError extends Error {
	constructor(message = '') {
		super();

		/**
		 * Error name (PushError).
		 */
		this.name = 'PushError';

		/**
		 * Error message.
		 */
		this.message = message;
	}
}

module.exports = PushError;
