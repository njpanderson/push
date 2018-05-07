const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const glob = require('glob');

const ExtendedStream = require('./ExtendedStream');
const PathCache = require('../lib/PathCache');

class Paths {
	fileExists(file) {
		file = this.getNormalPath(file);
		return fs.existsSync(file);
	}

	getPathCache() {
		if (!this.pathCache) {
			this.pathCache = new PathCache();
		}

		return this.pathCache;
	}

	/**
	 * Retrieves the current workspace root path from the active workspace.
	 */
	getWorkspaceRootPaths() {
		if (vscode.workspace.workspaceFolders.length) {
			return vscode.workspace.workspaceFolders;
		}

		return [];
	}

	/**
	 * Finds the current workspace path, based on the Uri of a passed item.
	 * @param {Uri} uri - Uri of the contextual item
	 * @param {*} normalise - `true` to normalise (i.e. stringify) the return Uri.
	 * @returns {mixed} Either a Uri or a string path of the workspace root.
	 */
	getCurrentWorkspaceRootPath(uri, normalise = false) {
		let workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);

		return (
			normalise ?
			this.getNormalPath(workspaceFolder.uri) :
			workspaceFolder.uri
		);
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

	getPathWithoutWorkspace(uri, workspace, requiredScheme) {
		let pathName = this.getNormalPath(uri, requiredScheme);

		if (workspace) {
			return pathName.replace(
				workspace.rootPath,
				''
			)
		}

		return pathName;
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
	 * @param {string} dir - Dir to remove trailing slash
	 */
	stripTrailingSlash(dir) {
		return dir.replace(/\/$/, '');
	}

	/**
	 * Return a path with a trailing slash.
	 * @param {string} dir - Dir to ensure a trailing slash
	 */
	addTrailingSlash(dir) {
		return this.stripTrailingSlash(dir) + '/';
	}

	/**
	 * Returns whether the supplied path is a directory. A shortcut for the fs.statSync method.
	 * @param {string|Uri} dir - Directory to validate
	 * @returns {boolean} `true` if the path is a directory, `false` otherwise.
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
			new glob.Glob(
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

			new glob.Glob(
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
	 * @param {string} file - The filename to look for.
	 * @param {string} startDir - The directory to start looking in.
	 */
	findFileInAncestors(file, startDir) {
		let loop = 0,
			rootPaths = this.getWorkspaceRootPaths();

		while (!fs.existsSync(startDir + path.sep + file)) {
			if (rootPaths.indexOf(startDir) !== -1 || loop === 50) {
				// dir matches any root paths or hard loop limit reached
				return null;
			}

			startDir = startDir.substring(0, startDir.lastIndexOf(path.sep));
			loop += 1;
		}

		return path.join(startDir + path.sep + file);
	}

	/**
	 * Retrieves a source file based on the workspace of the command.
	 * @param {object} [uri] - Source file Uri.
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

	/**
	 * Check that a Uri scheme is valid (i.e. Push can work with it)
	 * @param {Uri} uri - Uri to check.
	 */
	isValidScheme(uri) {
		return (uri.scheme === 'file' || uri.scheme === '' || !uri.scheme);
	}

	/**
	 * Process a Uri and retrieve the basename component.
	 * @param {Uri} uri - Uri to process.
	 */
	getBaseName(uri) {
		return path.basename(this.getNormalPath(uri));
	}

	/**
	 *
	 * @param {string|Uri} uri - Uri or pathname.
	 * @param {boolean} [returnIfDirectory=false] - If the path supplied is already a
	 * directory, just return it.
	 */
	getDirName(uri, returnIfDirectory = false) {
		if (returnIfDirectory && this.isDirectory(uri)) {
			return this.getNormalPath(uri);
		}

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

	writeFile(contents, fileName) {
		return new Promise((resolve, reject) => {
			fs.writeFile(
				fileName,
				contents,
				{
					encoding: 'utf8'
				},
				(error) => {
					if (error) {
						reject(error);
					} else {
						resolve(fileName);
					}
				}
			);
		});
	}

	readFile(fileName) {
		return new Promise((resolve, reject) => {
			fs.readFile(fileName, (error, data) => {
				if (error) {
					reject(error);
				} else {
					resolve(data);
				}
			});
		});
	}
}

Paths.sep = path.sep;

module.exports = Paths;
