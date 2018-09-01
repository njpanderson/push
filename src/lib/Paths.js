const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const glob = require('glob');

const ExtendedStream = require('./ExtendedStream');
const PathCache = require('./pathcache/Index');
const utils = require('../lib/utils');

/**
 * Provides Path utilities within the VSCode environment.
 */
class Paths {
	/**
	 * Checks if a Uri exists on the filesystem.
	 * @param {Uri} uri - Uri to check.
	 */
	fileExists(uri) {
		utils.assertFnArgs('Paths#fileExists', arguments, [vscode.Uri]);
		return fs.existsSync(this.getNormalPath(uri, 'file'));
	}

	/**
	 * Returns a current or new instance of PathCache.
	 * @returns {PathCache} - An instance of PathCache.
	 */
	getPathCache() {
		if (!this.pathCache) {
			this.pathCache = new PathCache();
		}

		return this.pathCache;
	}

	/**
	 * Tests whether the first Uri is within the second.
	 * @param {Uri} path - Uri to find.
	 * @param {Uri} rootUri - Uri to find within.
	 */
	pathInUri(path, rootUri) {
		utils.assertFnArgs('Paths#pathInUri', arguments, [vscode.Uri, vscode.Uri]);

		if (!path || !rootUri) {
			return false;
		}

		return this.getNormalPath(path).startsWith(this.getNormalPath(rootUri));
	}

	/**
	 * Retrieves the active workspace folders.
	 * @returns {array} Either an array of workspace folders, or an empty array if
	 * nothing was found.
	 */
	getWorkspaceFolders() {
		if (
			vscode.workspace &&
			vscode.workspace.workspaceFolders &&
			vscode.workspace.workspaceFolders.length
		) {
			return vscode.workspace.workspaceFolders;
		}

		return [];
	}

	/**
	 * Checks if the supplied folder Uri is within one of the supplied workspace roots.
	 * @param {Uri} dir
	 * @param {WorkspaceFolder[]} workspaceFolders
	 */
	isWorkspaceFolderRoot(dir, workspaceFolders = []) {
		utils.assertFnArgs('Paths#isWorkspaceFolderRoot', arguments, [vscode.Uri]);

		dir = this.getNormalPath(dir);

		return (workspaceFolders.findIndex((folder) => {
			return folder.uri.fsPath === dir;
		}) !== -1);
	}

	/**
	 * Finds the current workspace path, based on the Uri of a passed item.
	 * @param {Uri} uri - Uri of the contextual item
	 * @param {*} normalise - `true` to normalise (i.e. stringify) the return Uri.
	 * @returns {mixed} Either a Uri or a string path of the workspace root.
	 */
	getCurrentWorkspaceRootPath(uri, normalise = false) {
		utils.assertFnArgs('Paths#getCurrentWorkspaceRootPath', arguments, [vscode.Uri]);

		let workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);

		return (
			normalise ?
				this.getNormalPath(workspaceFolder.uri) :
				workspaceFolder.uri
		);
	}

	/**
	 * Gets a string representation of a Uri.
	 * @param {string|Uri} uri - The Uri to parse.
	 * @param {string} requiredScheme - If required, the scheme the supplied Uri
	 * must follow.
	 */
	getNormalPath(uri, requiredScheme) {
		if (typeof uri === 'string' ||
			uri === null ||
			uri === undefined) {
			return uri;
		}

		if (requiredScheme !== undefined && uri.scheme !== requiredScheme) {
			return false;
		}

		return uri.fsPath || uri.path;
	}

	/**
	 * Gets a path (Uri) without the workspace root.
	 * @param {Uri} uri - The path to strip from.
	 * @param {Workspace} workspace - The workspace to strip.
	 * @param {string} [requiredScheme] - The required scheme of the path.
	 * @returns {Uri} The path without the workspace
	 */
	getPathWithoutWorkspace(uri, workspace, requiredScheme) {
		utils.assertFnArgs('Paths#getPathWithoutWorkspace', arguments, [vscode.Uri]);

		if (workspace) {
			return vscode.Uri.file(
				this.getNormalPath(uri, requiredScheme).replace(
					workspace.rootPath,
					''
				)
			);
		}

		return uri;
	}

	/**
	 * UNUSED
	 * @param {*} src
	 * @private
	 * TODO: Remove?
	 */
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
	 * @param {string} pathName - Path to remove a trailing slash from.
	 * @returns {string} The path without a trailing slash.
	 */
	stripTrailingSlash(pathName) {
		return pathName.replace(/\/$/, '');
	}

	/**
	 * Return a path with a trailing slash.
	 * @param {string} pathName - Path on which to ensure a trailing slash.
	 * @returns {string} The path with a trailing slash.
	 */
	addTrailingSlash(pathName) {
		return this.stripTrailingSlash(pathName) + '/';
	}

	/**
	 * Joins a path using the built in node Path method, returns a Uri.
	 * @param {...Uri|string} - Path components to join.
	 * @returns {Uri} The resulting Uri.
	 */
	join() {
		let parts = [...arguments].map((item) =>
			(item instanceof vscode.Uri ? this.getNormalPath(item) : item)
		);

		return vscode.Uri.file(path.join.apply(path, parts));
	}

	/**
	 * Returns whether the supplied path is a directory. A shortcut for the fs.statSync method.
	 * @param {Uri} uri - Directory to validate
	 * @returns {boolean} `true` if the path is a directory, `false` otherwise.
	 */
	isDirectory(uri) {
		utils.assertFnArgs('Paths#isDirectory', arguments, [vscode.Uri]);

		uri = this.getNormalPath(uri, 'file');

		if (uri) {
			// Use a try block to suppress statSync exceptions
			try {
				const stats = fs.statSync(uri);
				return stats.isDirectory();
			} catch(e) {
				return false;
			}
		}

		return false;
	}

	/**
	 * Obtain a consistent set of Glob options.
	 * @param {object} [extend] - Optionally extend the options with further options.
	 * @returns {object} A set of options, for use with Glob.
	 */
	getGlobOptions(extend = {}) {
		return Object.assign({
			// Match dotfiles (".filename")
			dot: true,
			// Don't match directories (but still follow them)
			nodir: true,
			// Don't follow symlinks
			follow: false
		}, extend);
	}

	/**
	 * @description
	 * List the contents of a single filesystem-accessible directory.
	 *
	 * `loc` provides a mechanism for distinguishing between multiple "sets" of
	 * caches. The distinction is arbitrary but generally recommended to use one
	 * of the `PathCache.sources` options for consistent recall.
	 *
	 * An existing `cache` instance (of PathCache) may be supplied. Otherwise,
	 * an instance specific to the Paths class is created.
	 * @param {string} dir - Directory to list
	 * @param {number} [loc=PathCache.sources.LOCAL] - `PathCache.sources` locations.
	 * @param {PathCache} [cache] - PathCache instance. Will use an internal instance
	 * if not specified.
	 * @returns {Promise<PathCacheList>} A promise resolving to a directory list.
	 */
	listDirectory(dir, loc = PathCache.sources.LOCAL, cache) {
		// Use supplied cache or fall back to class instance
		dir = this.stripTrailingSlash(dir);
		cache = cache || this.getPathCache();

		if (cache.dirIsCached(loc, dir)) {
			return Promise.resolve(cache.getDir(loc, dir));
		} else {
			return new Promise((resolve, reject) => {
				fs.readdir(dir, (error, list) => {
					if (error) {
						return reject(error);
					}

					list.forEach((filename) => {
						let pathname = dir + Paths.sep + filename,
							stats = fs.statSync(pathname);

						cache.addFilePath(
							loc,
							pathname,
							(stats.mtime.getTime() / 1000),
							(stats.isDirectory() ? 'd' : 'f')
						);
					});

					resolve(cache.getDir(loc, dir));
				});
			});
		}
	}

	/**
	 * Recursively returns the file contents of a directory.
	 * @param {uri|string|array} include - Uri of directory to glob for paths, a glob string,
	 * or an array of path components.
	 * @param {array} [ignoreGlobs] - List of globs to ignore.
	 */
	getDirectoryContentsAsFiles(include, ignoreGlobs = [], followSymlinks = false) {
		if (include instanceof vscode.Uri) {
			// Create path out of Uri
			include = `${this.getNormalPath(include)}${path.sep}**`;
		}

		if (Array.isArray(include)) {
			// Create path out of array elements
			include = path.join.apply(path, include);
		}

		return new Promise((resolve, reject) => {
			new glob.Glob(
				this.ensureGlobPath(include),
				this.getGlobOptions({
					ignore: ignoreGlobs,
					follow: followSymlinks
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

	/**
	 * Filters a Uri by the array of ignoreGlobs globs.
	 * @param {Uri} uri - The Uri to check.
	 * @param {string[]} [ignoreGlobs] - An array of globs to match against.
	 * @returns {Promise} - resolving to either the original Uri, or `false` in
	 * the case that one of the ignoreGlobs globs matched.
	 */
	filterUriByGlobs(uri, ignoreGlobs = []) {
		return new Promise((resolve, reject) => {
			if (!Array.isArray(ignoreGlobs) || !ignoreGlobs.length) {
				resolve(uri);
			}

			new glob.Glob(
				`${this.ensureGlobPath(uri)}`,
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
			);
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
		dir = dir.replace(/^\//, '');
		dir = dir.split('/');

		dir.forEach((segment) => {
			segment_dir += `/${segment}`;
			iterator(segment_dir);
		});
	}

	/**
	 * Attempts to look for a file within a directory, recursing up through the path until
	 * the root of the active workspace is reached.
	 * @param {string} fileName - The filename to look for. Supports globs.
	 * @param {Uri} start - The directory to start looking in.
	 * @returns {Uri|null} - Either the matched Uri, or `null`.
	 */
	findFileInAncestors(fileName, start) {
		let matches,
			loop = 0,
			prev = '',
			folders = this.getWorkspaceFolders(),
			globOptions = {
				matchBase: true,
				follow: false,
				nosort: true
			};

		utils.assertFnArgs('Paths#findFileInAncestors', arguments, ['string', vscode.Uri]);

		start = this.getDirName(start);

		while (!(matches = (glob.sync(
			this.ensureGlobPath(start, fileName),
			globOptions
		))).length) {
			if (this.isWorkspaceFolderRoot(start, folders) || loop === 50) {
				// dir matches any root paths or hard loop limit reached
				return null;
			}

			// Strip off directory basename
			prev = start;
			start = this.getDirName(start);

			if (start.fsPath === prev.fsPath) {
				return null;
			}

			// startDir = startDir.substring(0, startDir.lastIndexOf('/'));
			loop += 1;
		}

		return vscode.Uri.file(matches[0]);
	}

	/**
	 * Retrieves a source file based on the workspace of the command.
	 * @param {object} [uri] - Source file Uri.
	 */
	getFileSrc(uri) {
		let folders;

		if (uri && uri instanceof vscode.Uri) {
			return uri;
		}

		// uri is not set or does not exist. attempt to get from the editor
		if (vscode.window.activeTextEditor) {
			return vscode.window.activeTextEditor &&
				vscode.window.activeTextEditor.document.uri;
		} else if ((folders = this.getWorkspaceFolders()).length) {
			return folders[0].uri;
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
	 * @description
	 * Check that a Uri or string path is valid.
	 *
	 * Checks that the path:
	 * - Has at least one directory
	 * - Contains a "root" path (e.g. / or c:\)
	 * - Doesn't contain "bad" characters (e.g. traversal characters)
	 * @param {Uri|string} uri
	 */
	isValidPath(uri) {
		uri = path.parse(this.getNormalPath(uri));

		return !(
			uri.dir.length < 1 ||
			uri.root === '' ||
			Paths.re.badPathChars.test(uri.dir)
		);
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
			return uri;
		}

		return vscode.Uri.file(path.dirname(this.getNormalPath(uri)));
	}

	ensureDirExists(dir) {
		return new Promise((resolve, reject) => {
			this.getFileStats(dir)
				.then(stats => {
					if (!stats) {
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
				});
		});
	}

	/**
	 * Writes a file to disk using UTF8 encoding.
	 * @param {string} contents - File contents.
	 * @param {Uri} uri - Filename Uri.
	 */
	writeFile(contents, uri) {
		return new Promise((resolve, reject) => {
			fs.writeFile(
				this.getNormalPath(uri),
				contents,
				{
					encoding: 'utf8'
				},
				(error) => {
					if (error) {
						reject(error);
					} else {
						resolve(uri);
					}
				}
			);
		});
	}

	/**
	 * Reads a file and returns its contents
	 * @param {Uri} uri - Uri of the file to read.
	 */
	readFile(uri) {
		utils.assertFnArgs('Paths#readFile', arguments, [vscode.Uri]);

		return new Promise((resolve, reject) => {
			fs.readFile(this.getNormalPath(uri), (error, data) => {
				if (error) {
					reject(error);
				} else {
					resolve(data);
				}
			});
		});
	}

	/**
	 * @param {string} fileName - Name of the file to stat
	 * @description
	 * Non-rejecting file stats function. This function will safely (and consistently)
	 * retrieve local file stats without bothering with rejections or exceptions (and
	 * will just return `null` if the file isn't found).
	 */
	getFileStats(fileName) {
		return new Promise((resolve) => {
			fs.stat(fileName, (error, stat) => {
				let result;

				if (!error && stat) {
					result = {
						name: path.basename(fileName),
						modified: (stat.mtime.getTime() / 1000),
						type: (stat.isDirectory() ? 'd' : 'f')
					};
				} else {
					result = null;
				}

				resolve(result);
			});
		});
	}

	/**
	 * @param {...Uri|string} pathName - The path to make glob 'friendly'
	 * @description
	 * Ensures a path can be used with glob (even on windows). Each argument is
	 * joined by a glob compatible separator (/).
	 */
	ensureGlobPath() {
		return [...arguments].reduce(
			(acc, part) => acc + '/' + this
				.getNormalPath(part)
				.replace(/\\/g, '/')
				.replace(/^\//, ''),
			''
		);
	}
}

Paths.sep = path.sep;

Paths.re = {
	badPathChars: /\.\.\//
};

module.exports = Paths;
