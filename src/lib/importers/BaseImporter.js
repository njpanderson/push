const jsonc = require('jsonc-parser');

const Paths = require('../Paths');

class BaseImporter {
	constructor() {
		this.paths = new Paths();
	}

	loadFile(file) {
		return this.paths.readFile(file);
	}

	parseJSON(fileContents) {
		return jsonc.parse(fileContents);
	}
}

module.exports = BaseImporter;