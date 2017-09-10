const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

class Paths {
	/**
	 * Replaces the current workspace root path with `root` within the `dir` string.
	 * @param {string} dir - Dir to perform replacement on.
	 * @param {string} root - Root path to use instead.
	 */
	replaceWorkspaceWithRoot(dir, root) {
		return this.stripTrailingSlash(root) + '/' +
			dir.replace(this.getCurrentWorkspaceRootPath() + '/', '');
	}

	/**
	 * Replaces the directory of `serviceFilename` with `root` within the `dir` string.
	 * @param {string} dir - Dir to perform replacement on.
	 * @param {string} serviceFilename - Contextually active service settings filename. (e.g:
	 * .push.settings.json)
	 * @param {string} root - Root path to use instead.
	 */
	replaceServiceContextWithRoot(dir, serviceFilename, root) {
		return this.stripTrailingSlash(root) + '/' +
			dir.replace(path.dirname(serviceFilename) + '/', '');
	}

	/**
	 * Retrieves the current workspace root path from the active workspace.
	 */
	getCurrentWorkspaceRootPath() {
		if (vscode.workspace.workspaceFolders.length) {
			return vscode.workspace.workspaceFolders[0].uri.path;
		}

		if (vscode.window.activeTextEditor) {
			return path.dirname(vscode.window.activeTextEditor.document.uri);
		}

		return '';
	}

	getNormalPath(uri) {
		if (typeof uri === 'string') {
			return uri;
		}

		return uri.fsPath || uri.path;
	}

	/**
	 * Return a path without a trailing slash.
	 * @param {string} path
	 */
	stripTrailingSlash(dir) {
		return dir.replace(/\/$/, '');
	}

	/**
	 * Returns whether the supplied path is a directory. A shortcut for the fs.statSync method.
	 * @param {string} dir
	 */
	isDirectory(dir) {
		const stats = fs.statSync(this.getNormalPath(dir));
		return stats.isDirectory();
	}

	getDirectoryContentsAsFiles(dir) {
		dir = this.getNormalPath(dir);
		dir = dir.replace(this.getCurrentWorkspaceRootPath() + '/', '');
		return vscode.workspace.findFiles(`${dir}/**/*`);
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
	findFileInAncestors(file, startDir) {
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

	/**
	 * Retrieves a source file based on the workspace of the command.
	 * @param {object} uri - Source file URI
	 */
	getFileSrc(uri) {
		if (uri) {
			return uri;
		}

		// uri is not set or does not exist. attempt to get from the editor
		if (vscode.window.activeTextEditor) {
			return vscode.window.activeTextEditor &&
				vscode.window.activeTextEditor.document.uri;
		}

		return '';
	}
}

module.exports = Paths;