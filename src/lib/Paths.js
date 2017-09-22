const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const Glob = require('glob').Glob;

class Paths {
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

	getNormalPath(uri, requiredScheme) {
		if (requiredScheme !== undefined && uri.scheme !== requiredScheme) {
			return false;
		}

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
		dir = this.getNormalPath(dir, 'file');

		if (dir) {
			const stats = fs.statSync(this.getNormalPath(dir));
			return stats.isDirectory();
		}

		return false;
	}

	getGlobOptions(extend = {}) {
		return Object.assign({
			dot: true,
			nodir: true
		}, extend);
	}

	/**
	 * Recursively returns the contents of a directory.
	 * @param {Uri} uri - Uri of directory to glob for paths
	 */
	getDirectoryContentsAsFiles(uri, ignoreGlobs = []) {
		let dir = this.getNormalPath(uri);

		return new Promise((resolve, reject) => {
			new Glob(
				`${dir}/**/*`,
				this.getGlobOptions({
					ignore: ignoreGlobs
				}),
				(error, matches) => {
					if (error) {
						reject(error);
					}

					resolve(matches);
				}
			);
		});

		// dir = this.getNormalPath(dir);
		// dir = dir.replace(this.getCurrentWorkspaceRootPath() + '/', '');
		// return vscode.workspace.findFiles(`${dir}/*/**/*`);
	}

	filterUriByGlobs(uri, ignoreGlobs = []) {
		return new Promise((resolve, reject) => {
			if (!Array.isArray(ignoreGlobs) || !ignoreGlobs.length) {
				resolve(uri);
			}

			new Glob(
				`${this.getNormalPath(uri)}`,
				this.getGlobOptions({
					ignore: ignoreGlobs
				}),
				(error, matches) => {
					if (error) {
						reject(error);
					}

					if (matches.length) {
						resolve(vscode.Uri.parse(matches[0]));
					} else {
						resolve(false);
					}
				}
			)
		});
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

	getBaseName(uri) {
		return path.basename(this.getNormalPath(uri));
	}
}

module.exports = Paths;