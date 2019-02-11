const fs = require('fs');
const path = require('path');

const PATH_ROOT = path.resolve.apply(path, __dirname.split(path.sep).slice(0, -3));

module.exports = {
	PATH_ROOT,
	PATH_ASSETS: path.join(PATH_ROOT, 'assets'),

	DEBUG: fs.existsSync(path.join(PATH_ROOT, '.debug'))
};
