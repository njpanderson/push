const packageJson = require('../../package.json');

function getConfig() {
	let config = {}, prop, name;

	for (prop in packageJson.contributes.configuration.properties) {
		name = prop.replace(/njpPush\./, '');
		config[name] = packageJson.contributes.configuration.properties[prop].default;
	}

	return config;
}

module.exports = getConfig();