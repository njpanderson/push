class Service {
	exec(method, config, args) {
		return this[method].apply(this, args);
	}

	convertUriToRemote(uri) {
		return uri;
	}
}

module.exports = Service;