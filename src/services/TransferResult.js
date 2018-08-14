const { TRANSFER_TYPES } = require('../lib/constants');

/**
 * @param {string} srcPath - The source file being transferred.
 * @param {boolean|Error} status - The status of the transfer. Either a basic
 * boolean `true` for success or `false` for failure, or `Error` for a more
 * detailed error.
 * @param {number} type - One of the {@link TRANSFER_TYPES} types.
 * @description
 * Create a Transfer result instance.
 *
 * If an `Error` object is provided as `status`, then its error message will
 * be written to the channel. Do not use errors which may confuse the user
 * and/or are not localised. (I.e. do not use errors directly from APIs).
 */
class TransferResult {
	constructor(srcPath, status = true, type = TRANSFER_TYPES.PUT) {
		this.src = srcPath;
		this.status = (status === true ? status : false);
		this.type = type;
		this.error = ((status instanceof Error) ? status : null);
	}
}

module.exports = TransferResult;
