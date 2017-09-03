class PushModel {
	/**
	 * @description
	 * Attempts to retrieve the settings JSON from the supplied URI, eventually ascending
	 * the directory tree to the root of the project.
	 * @param {string} uri - URI of the path in which to start looking
	 */
	getSettingsJSON(uri) {
		return {
			foo: 'bar'
		}
	}
}

module.exports = PushModel;