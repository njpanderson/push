const paths = new (require('../Paths'));

/**
 * @description
 * Contains the definition of a settings file picker result. Used primarily as
 * the response from {@link Service#getFileNamePrompt}.
 * @param {Uri} uri - The associated Uri.
 * @param {string} - The selected service type.
 */
class ServicePromptResult {
	constructor(uri, serviceType = null) {
		this.uri = uri;
		this.serviceType = serviceType;
		this.exists = paths.fileExists(uri);
	}
}

module.exports = ServicePromptResult;
