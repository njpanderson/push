const vscode = require('vscode');

const { TRANSFER_TYPES, QUEUE_LOG_TYPES } = require('../lib/constants');

/**
 * @typedef {object} TransferResultOptions
 * @property {srcLabel} - Override the `src` label with this custom string.
 */

/**
 * @param {Url} src - The source file Uri being transferred.
 * @param {boolean|Error} status - The status of the transfer. Either a basic
 * boolean `true` for success or `false` for skipped, or `Error` for a more
 * detailed error.
 * @param {number} type - One of the {@link TRANSFER_TYPES} types.
 * @param {TransferResultOptions} [options] - Transfer result options.
 * @description
 * Create a Transfer result instance.
 *
 * If an `Error` object is provided as `status`, then its error message will
 * be written to the channel. Do not use errors which may confuse the user
 * and/or are not localised. (I.e. do not use errors directly from APIs).
 */
class TransferResult {
	constructor(src, status = true, type = TRANSFER_TYPES.PUT, options = {}) {
		if (!(src instanceof vscode.Uri)) {
			throw new Error('src must be an instance of vscode.Uri');
		}

		this.src = src;
		this.status = (status === true ? status : false);
		this.type = type;
		this.options = options;
		this.error = ((status instanceof Error) ? status : null);

		if (this.error) {
			this.logType = QUEUE_LOG_TYPES.fail;
		} else if (this.status === false) {
			this.logType = QUEUE_LOG_TYPES.skip;
		} else {
			this.logType = QUEUE_LOG_TYPES.success;
		}
	}
}

module.exports = TransferResult;
