const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

class Paths {
	/**
	 * Takes a path and returns it, replacing the portion above the workspace
	 * root with the supplied root
	 * @param {string} path
	 */
	replaceWorkspaceWithRoot(path, root) {
		return this.stripTrailingSlash(root) + '/' +
			path.replace(this.getCurrentWorkspaceRootPath() + '/', '');
		}

	getCurrentWorkspaceRootPath() {
		if (vscode.workspace.workspaceFolders.length) {
			return vscode.workspace.workspaceFolders[0].uri.path;
		}

		if (vscode.window.activeTextEditor) {
			return path.dirname(vscode.window.activeTextEditor.document.uri);
		}

		return '';
	}

	/**
	 * Return a path without a trailing slash
	 * @param {string} path
	 */
	stripTrailingSlash(dir) {
		return dir.replace(/\/$/, '');
	}

	isDirectory(dir) {
		const stats = fs.statSync(dir);
		return stats.isDirectory();
	}

	/**
	 * Iterates over each segment of a path, invoking an iterator function with
	 * a cumulative portion of that path.
	 * @param {string} dir
	 * @param {function} iterator
	 */
	iterateDirectoryPath(dir, iterator) {
		let segment_dir = '';

		dir = path.dirname(dir);
		dir = dir.replace(/^\//, '')
		dir = dir.split('/');

		dir.forEach((segment) => {
			segment_dir += `/${segment}`;
			iterator(segment_dir);
		});
	}

	/**
	 * Attempts to look for a file within a directory, recursing up through the path until
	 * the root of the active workspace is reached.
	 * @param {string} file
	 * @param {string} startDir
	 */
	findFile(file, startDir) {
		let loop = 0,
			rootPath = this.getCurrentWorkspaceRootPath();

		while(!fs.existsSync(startDir + '/' + file)) {
			if (startDir === rootPath || loop === 50) {
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