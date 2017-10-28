const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const Glob = require('glob').Glob;

const ExtendedStream = require('./ExtendedStream');
const PathCache = require('../lib/PathCache');

class Paths {
	getPathCache() {
		if (!this.pathCache) {
			this.pathCache = new PathCache();
		}

		return this.pathCache;
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

	getNormalPath(uri, requiredScheme) {
		if (typeof uri === 'string') {
			return uri;
		}

		if (requiredScheme !== undefined && uri.scheme !== requiredScheme) {
			return false;
		}

		return uri.fsPath || uri.path;
	}

	getPathFromStreamOrUri(src) {
		if (src instanceof vscode.Uri) {
			return this.getNormalPath(src);
		} else if (src instanceof ExtendedStream) {
			return src.read.path;
		} else if (typeof src === 'string') {
			return src;
		} else {
			throw new Error('Paths#getPathFromStreamOrUri - src source could not be determined.');
		}
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
			try {
				const stats = fs.statSync(this.getNormalPath(dir));
				return stats.isDirectory();
			} catch(e) {
				return false;
			}
		}

		return false;
	}

	getGlobOptions(extend = {}) {
		return Object.assign({
			dot: true,
			nodir: true
		}, extend);
	}

	listDirectory(dir, src = PathCache.sources.LOCAL, cache) {
		// Use supplied cache or fall back to class instance
		cache = cache || this.getPathCache();

		if (cache.dirIsCached(src, dir)) {
			return Promise.resolve(cache.getDir(src, dir));
		} else {
			return new Promise((resolve, reject) => {
				fs.readdir(dir, (error, list) => {
					if (error) {
						return reject(error);
					}

					list.forEach((filename) => {
						let pathname = dir + '/' + filename,
							stats = fs.statSync(pathname);

						cache.addCachedFile(
							src,
							pathname,
							(stats.mtime.getTime() / 1000),
							(stats.isDirectory() ? 'd' : 'f')
						);
					});

					resolve(cache.getDir(src, dir));
				});
			});
		}
	}

	/**
	 * Recursively returns the file contents of a directory.
	 * @param {uri|string} include - Uri of directory to glob for paths, or a glob string.
	 * @param {array} [ignoreGlobs] - List of globs to ignore.
	 */
	getDirectoryContentsAsFiles(include, ignoreGlobs = []) {
		let parsed;

		if (include instanceof vscode.Uri) {
			// Create path out of Uri
			include = `${this.getNormalPath(include)}${path.sep}**${path.sep}*`;
		}

		if (Array.isArray(include)) {
			// Create path out of array elements
			include = path.join.apply(path, include);
		}

		include = (include.split(path.sep)).join('/');
		parsed = path.parse(include);

		include = include.replace(parsed.root, '/');

		return new Promise((resolve, reject) => {
			new Glob(
				include,
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
						resolve(vscode.Uri.file(matches[0]));
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

		while (!fs.existsSync(startDir + path.sep + file)) {
			if (startDir === rootPath || loop === 50) {
				// dir matches root path or hard loop limit reached
				return null;
			}

			startDir = startDir.substring(0, startDir.lastIndexOf(path.sep));
			loop += 1;
		}

		return path.join(startDir + path.sep + file);
	}

	/**
	 * Retrieves a source file based on the workspace of the command.
	 * @param {object} uri - Source file URI
	 */
	getFileSrc(uri) {
		if (uri && uri instanceof vscode.Uri) {
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

	getDirName(uri) {
		return path.dirname(this.getNormalPath(uri));
	}

	ensureDirExists(dir) {
		return new Promise((resolve, reject) => {
			fs.stat(dir, (error, stat) => {
				if (!stat) {
					mkdirp(dir, function (error) {
						if (error) {
							reject(error);
						} else {
							resolve();
						}
					});
				} else {
					resolve();
				}
			})
		});
	}
}

module.exports = Paths;