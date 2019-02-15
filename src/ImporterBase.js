const jsonc = require('jsonc-parser');

const paths = require('./lib/paths');

class ImporterBase {
	/**
	 * Load a single file into the base importer.
	 * @param {Uri} uri - Uri of file to read.
	 */
	loadFile(uri) {
		return paths.readFile(uri);
	}

	parseJSON(fileContents) {
		return jsonc.parse(fileContents);
	}

	addArrayData(data, key, datum) {
		if (!data[key]) {
			data[key] = [];
		}

		data[key].push(datum);

		return data;
	}
}

module.exports = ImporterBase;
