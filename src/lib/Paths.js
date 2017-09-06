const vscode = require('vscode');
const fs = require('fs');

class Paths {
	/**
	 * Takes a path and returns it, replacing the portion above the workspace
	 * root with the supplied root
	 * @param {string} path
	 */
	replaceWorkspaceWithRoot(path, root) {
		return this.stripTrailingSlash(root) + '/' +
			path.replace(vscode.workspace.rootPath + '/', '');
	}

	/**
	 * Return a path without a trailing slash
	 * @param {string} path
	 */
	stripTrailingSlash(path) {
		return path.replace(/\/$/, '');
	}

	/**
	 * Attempts to look for a file within a directory, recursing up through the path until
	 * the root of the active workspace is reached.
	 * @param {string} file
	 * @param {string} startDir
	 */
	findFile(file, startDir) {
		let loop = 0;

		while(!fs.existsSync(startDir + '/' + file)) {
			if (startDir === vscode.workspace.rootPath || loop === 50) {
				// dir matches root path or hard loop limit reached
				return null;
			}

			startDir = startDir.substring(0, startDir.lastIndexOf('/'));
			loop += 1;
		}

		return startDir + '/' + file;
	}
}

module.exports = Paths;