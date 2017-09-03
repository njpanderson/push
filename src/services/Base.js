class ServiceBase {
	init() {

	}

	/**
	 * Base service file upload method.
	 * @param {string} src - File source URI
	 * @param {string} dest - File destination path
	 */
	upload() {
		throw new Error('Service #upload method is not yet defined.');
	}

	/**
	 * Base service file download method.
	 * @param {string} src - File source path
	 * @param {string} dest - File destination URI
	 */
	download() {
		throw new Error('Service #download method is not yet defined.');
	}
};

module.exports = ServiceBase;