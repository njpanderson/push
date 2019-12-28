const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const glob = require('glob');
const micromatch = require('micromatch');

const ExtendedStream = require('../lib/types/ExtendedStream');
const Cache = require('./Cache');
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
		return fs.existsSync(this.getNormalPath(uri, 'file'));
	}

	/**
	 * Returns a current or new instance of Cache.
	 * @returns {Cache} An instance of Cache.
	 */
	getCache() {
		if (!this.pathCache) {
			this.pathCache = new Cache();
		}

		return this.pathCache;
	}

	/**
	 * Tests whether the first Uri is within the second.
	 * @param {Uri} path - Uri to find.
	 * @param {Uri} rootUri - Uri to find within.
	 */
	pathInUri(path, rootUri) {
		if (!path || !rootUri) {
			return false;
		}

		return this.getNormalPath(path).startsWith(this.getNormalPath(rootUri));
	}

	/**
	 * Tests whether the supplied path is within an active workspace folder.
	 * @param {Uri} uri - The path to test.
	 * @returns {boolean} `true` if the path is within the workspace.
	 */
	pathInWorkspaceFolder(uri) {
		return (this.getWorkspaceFolders().findIndex((workspaceFolder) => {
			return this.pathInUri(uri, workspaceFolder.uri);
		}) !== -1);
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
	 * @param {Workspace} workspace - The workspace to look for root folders to strip.
	 * @returns {Uri} The path without the workspace, or the original path, in
	 * case that the path falls outside of the workspace.
	 */
	getPathWithoutWorkspace(uri, workspace) {
		let filePath = workspace.asRelativePath(uri);

		return (
			!(filePath instanceof vscode.Uri) ?
				filePath :
				this.getNormalPath(uri)
		);
	}

	/**
	 * UNUSED
	 * @param {*} src
	 * @private
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
	 * @param {string} [sep] - Separator slash. Defaults to system preference.
	 * @returns {string} The path without a trailing slash.
	 */
	stripTrailingSlash(pathName, sep = path.sep) {
		return pathName.endsWith(sep) ? pathName.slice(0, -1) : pathName;
	}

	/**
	 * Return a path with a trailing slash.
	 * @param {string} pathName - Path on which to ensure a trailing slash.
	 * @param {string} [sep] - Separator slash. Defaults to system preference.
	 * @returns {string} The path with a trailing slash.
	 */
	addTrailingSlash(pathName, sep = path.sep) {
		return this.stripTrailingSlash(pathName, sep) + sep;
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
	 * List the contents of a single filesystem-accessible directory.
	 * @param {string} dir - Directory to list.
	 * @param {Cache} [cache] - Cache instance. Will use an internal instance
	 * if not specified.
	 * @description
	 * An existing `cache` instance (of Cache) may be supplied. Otherwise,
	 * a generic cache instance is created.
	 * @returns {Promise<CacheList>} A promise resolving to a directory list.
	 */
	listDirectory(dir, cache) {
		dir = this.stripTrailingSlash(dir);

		// Use supplied cache or fall back to class instance
		cache = cache || this.getCache();

		if (cache.dirIsCached(dir)) {
			return Promise.resolve(cache.getDir(dir));
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
							pathname,
							(stats.mtime.getTime() / 1000),
							(stats.isDirectory() ? 'd' : 'f')
						);
					});

					resolve(cache.getDir(dir));
				});
			});
		}
	}

	/**
	 * Recursively returns the file contents of a directory.
	 * @param {uri|string|array} include - Uri of directory to glob for paths, a
	 * glob string, or an array of path components.
	 * @param {array} [ignoreGlobs] - List of globs to ignore.
	 * @param {boolean} [followSymlinks=false] - Set `true` to follow symlinked
	 * directories when scanning for files.
	 * @returns {Promose<array>} Resolving to an array of files.
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
					let a;

					if (error) {
						reject(error);
					}

					if (matches.length) {
						// Ensure paths match the OS requirements by resolving them
						for (a = (matches.length - 1); a > -1; a -= 1) {
							matches[a] = path.resolve(matches[a]);
						}
					}

					resolve(matches);
				}
			);
		});
	}

	/**
	 * Filters a bunch of Uris by the provided globs
	 * @param {Uri[]} uris - An array of Uris to check.
	 * @param {string[]} ignoreGlobs - An array of globs to match against.
	 * @returns {Promise<Object>} resolving to an object containing the
	 * remaining Uris and a count of ignored Uris.
	 */
	filterUrisByGlobs(uris, ignoreGlobs = []) {
		return new Promise((resolve, reject) => {
			let matches;

			if (!Array.isArray(ignoreGlobs) || !ignoreGlobs.length) {
				resolve(uris);
			}

			try {
				// Get uris not matching from micromatch
				matches = micromatch.not(
					Array.from(uris, uri => uri.fsPath), ignoreGlobs
				);

				// Convert back to Uris and resolve
				resolve({
					uris: Array.from(matches, match => vscode.Uri.file(match)),
					ignored: (uris.length - matches.length)
				});
			} catch(e) {
				reject(e);
			}
		});
	}

	/**
	 * Filters a Uri by the array of ignoreGlobs globs.
	 * @param {Uri} uri - The Uri to check.
	 * @param {string[]} [ignoreGlobs] - An array of globs to match against.
	 * @returns {Promise<Uri>|Promise<false>} resolving to either the original Uri,
	 * or `false` in the case that one of the `ignoreGlobs` globs matched.
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
						resolve(vscode.Uri.file(path.resolve(matches[0])));
					} else {
						resolve(false);
					}
				}
			);
		});
	}

	/**
	 * Attempts to look for a file within a directory, recursing up through the path until
	 * the root of the active workspace is reached.
	 * @param {string} fileName - The filename to look for. Supports globs.
	 * @param {Uri} start - The directory to start looking in.
	 * @param {boolean} [limitToWorkspace=true] - Limit traversal to the workspace
	 * root.
	 * @returns {Uri|null} Either the matched Uri, or `null`.
	 */
	findFileInAncestors(fileName, start, limitToWorkspace = true) {
		let matches,
			loop = 0,
			prev = '',
			folders = this.getWorkspaceFolders(),
			globOptions = {
				matchBase: true,
				follow: false,
				nosort: true
			};

		start = this.getDirName(start, true);

		utils.trace(
			'Paths#findFileInAncestors',
			`Looking for file in: ${start}`
		);

		while (!(matches = (glob.sync(
			this.ensureGlobPath(start, fileName),
			globOptions
		))).length) {
			if (
				// Dir matches a root path
				(limitToWorkspace && this.isWorkspaceFolderRoot(start, folders)) ||
				// Loop limit reached
				loop === 50 ||
				// Dir matches FS root
				start.fsPath === prev.fsPath
			) {
				return null;
			}

			// Strip off directory basename
			prev = start;
			start = this.getDirName(start);

			// startDir = startDir.substring(0, startDir.lastIndexOf('/'));
			loop += 1;

			utils.trace(
				'Paths#findFileInAncestors',
				`Looking for file in: ${start}`
			);
		}

		return vscode.Uri.file(matches[0]);
	}

	/**
	 * Retrieves a source file based on the workspace of the command.
	 * @param {object} [uri] - Source file Uri. In the case that a Uri is not
	 * supplied, a contextual Uri may be returned.
	 * @returns {Uri|null} A Uri, or null if a contextual Uri could not be found.
	 */
	getFileSrc(uri) {
		let folders, editorUri;

		if (uri && uri instanceof vscode.Uri) {
			// Uri is already valid - just return it
			return uri;
		}

		if (vscode.window.activeTextEditor) {
			// Get active editor Uri
			editorUri = vscode.window.activeTextEditor &&
				vscode.window.activeTextEditor.document.uri;

			if (this.isValidScheme(editorUri)) {
				// Uri is valid, return it
				return editorUri;
			}

			// Try to find a valid TextEditor/Uri in the active list
			editorUri = vscode.window.visibleTextEditors.find((editor) => {
				return editor.document && this.isValidScheme(editor.document.uri);
			});

			if (editorUri) {
				// Found a valid editor Uri! return it...
				return editorUri.document.uri;
			}
		} else if ((folders = this.getWorkspaceFolders()).length) {
			// Return base workspace Uri
			return folders[0].uri;
		}

		return null;
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
	 * @param {Uri} uri
	 * @returns	{boolean} `true` if the path validates, `false` otherwise.
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
	 * @returns {string} The basename of the file.
	 */
	getBaseName(uri) {
		return path.basename(this.getNormalPath(uri));
	}

	/**
	 * Process a Uri and retrieve the extension component.
	 * @param {Uri} uri - Uri to process.
	 * @returns {string} The extension of the file.
	 */
	getExtName(uri) {
		return path.extname(this.getNormalPath(uri));
	}

	/**
	 *
	 * @param {Uri|string} uri - Uri or pathname.
	 * @param {boolean} [returnIfDirectory=false] - If the path supplied is already a
	 * directory, just return it.
	 * @returns {Uri} the original path's directory name, or the same path if it's
	 * already a directory and `returnIfDirectory` is `true`.
	 */
	getDirName(uri, returnIfDirectory = false) {
		if (returnIfDirectory && this.isDirectory(uri)) {
			return uri;
		}

		return vscode.Uri.file(path.dirname(this.getNormalPath(uri)));
	}

	/**
	 * Checks for the existence of a directory.
	 * @param {Uri} uri - The path to check.
	 * @returns {Promise} Resolving if the directory exists, rejecting otherwise.
	 */
	ensureDirExists(uri) {
		return new Promise((resolve, reject) => {
			this.getFileStats(this.getNormalPath(uri))
				.then(stats => {
					if (!stats) {
						mkdirp(this.getNormalPath(uri), function (error) {
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
			(acc, part) => acc + (acc ? '/' : '') +
				this
					.getNormalPath(part)
					.replace(/\\/g, '/'),
			''
		);
	}

	/**
	 * Writes content to a file and then opens it for editing.
	 * @param {string} content - Content to write to the file.
	 * @param {Uri} uri - Uri of the filename to write to.
	 */
	writeAndOpen(content, uri) {
		// Write the file...
		return this.writeFile(
			content,
			uri
		)
			.then((uri) => {
				// Open it
				utils.openDoc(uri);
			})
			.catch((error) => {
				// Append the error
				channel.appendError(error);
			});
	}
}

Paths.sep = path.sep;

Paths.re = {
	badPathChars: /\.\.\//
};

module.exports = Paths;
