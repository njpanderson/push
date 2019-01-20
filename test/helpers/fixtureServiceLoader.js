const fs = require('fs');
const path = require('path');

const vscode = require('../mocks/node/vscode');

function getPlatformPrefix() {
	switch (process.platform) {
	case 'win32':
		return path.join(path.dirname(__dirname), 'fixtures', 'project-dirs', 'win32');

	default:
		return path.join(path.dirname(__dirname), 'fixtures', 'project-dirs', 'posix');
	}
}

function replaceVars(ob, replacements = []) {
	let key;

	for (key in ob) {
		if (ob.hasOwnProperty(key)) {
			if (typeof ob[key] === 'object') {
				ob[key] = replaceVars(ob[key], replacements);
			} else {
				replacements.forEach((replacement) => {
					ob[key] = ob[key].replace(replacement[0], replacement[1]);
				});
			}
		}
	}

	return ob;
}

// function convertStringToJSON(string) {
// 	return (JSON.stringify(string)).replace(/"/g, '');
// }

/**
 * @param {string} type - Service file type.
 * @description
 * Loads a service file and returns its data, with some replacements
 * Service file type value should match the folder names with
 * fixtures/project-dirs/(posix|win32)/. i.e. File or SFTP, etc.
 */
module.exports = function fixtureServiceLoader(type = 'File') {
	const serviceFilepath = path.join(getPlatformPrefix(), type),
		serviceFilename = '.push.config.jsonc',
		testFilename = 'test-file.txt';

	let contents = fs.readFileSync(
			path.join(serviceFilepath, serviceFilename),
			'utf-8'
		),
		remoterootPath, remoteFilepath, remoteFileSubpath, data;

	// Set vars based on service type
	switch (type) {
	case 'File':
		remoterootPath = path.join(path.dirname(__dirname), 'fixtures', 'file-remote-target');
		remoteFilepath = path.join(remoterootPath, 'test-file.txt');
		remoteFileSubpath = path.join(remoterootPath, 'subfolder', 'test-file.txt');
		break;

	case 'SFTP':
		remoterootPath = '/path/to/remote/root';
		remoteFilepath = remoterootPath + '/test-file.txt';
		remoteFileSubpath = remoterootPath + '/subfolder/test-file.txt';
		break;
	}

	// Get JSON data, manipulated by replacement placeholders
	data = replaceVars(JSON.parse(contents), [
		['__ROOT_PATH__', remoterootPath]
	]);

	// Return as JSON
	return {
		local: {
			uri: vscode.Uri.file(path.join(serviceFilepath, testFilename)),
			subUri: vscode.Uri.file(path.join(serviceFilepath, 'subfolder', testFilename))
		},
		remote: {
			path: remoteFilepath,
			subPath: remoteFileSubpath
		},
		serviceData: {
			file: path.join(serviceFilepath, serviceFilename),
			data,
			contents: '',
			newFile: true,
			// TODO: Hash
			hash: '1234'
		}
	};
};
