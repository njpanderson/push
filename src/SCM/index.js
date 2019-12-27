const vscode = require('vscode');

const channel = require('../lib/channel');
const Paths = require('../Paths');
const i18n = require('../i18n');

class SCM {
	constructor() {
		this.paths = new Paths();
		this._provider = {
			id: null,
			dir: null,
			instance: null
		};
	}

	getProvider(provider, dir) {
		if (this._provider.id === provider &&
			this._provider.dir === dir &&
			this._provider.instance !== null) {
			// Provider ID/dir is unchanged - just return
			return this._provider;
		}

		this._provider = {
			id: provider,
			dir
		};

		switch (this._provider.id) {
		case SCM.providers.git:
			this._provider.instance = require('simple-git')(this._provider.dir);
			break;
		}

		return this._provider;
	}

	/**
	 * @param {number} provider - The provider to use. See SCM.providers.
	 * @param {string} dir - The base directory for this operation.
	 * @param {string} method - One of the available methods. (See below).
	 * @description
	 * Execute an available method.
	 *
	 * Available methods are:
	 *  - listWorkingFiles()
	 */
	exec(provider, dir, method) {
		method = method && '_' + method || null;
		provider = this.getProvider(provider, dir);

		if (method && this[method]) {
			return new Promise((resolve, reject) => {
				let result = this[method].apply(
					this,
					[provider, dir, [...arguments].slice(3)]
				);

				if (result instanceof Promise) {
					result
						.then(resolve)
						.catch((error) => {
							this._appendChannelMessage(
								'error',
								provider,
								error,
								dir
							);
							reject(error);
						});
				} else {
					resolve(result);
				}
			});
		} else {
			return Promise.reject(new Error(`Unknown method ${method}`));
		}
	}

	/**
	 * Lists all working files in an array of Uris
	 */
	_listWorkingUris(provider, dir) {
		return new Promise((resolve, reject) => {
			let files;

			switch (provider.id) {
			case SCM.providers.git:
				// Set working directory
				provider.instance.cwd(dir);

				// Get status, including changed files
				provider.instance.status((error, status) => {
					if (error) {
						return reject(error);
					}

					files = this._urisFromGitStatus(dir, status);
					resolve(files);
				});

				break;

			default:
				reject(new Error('Unknown provider.'));
			}
		});
	}

	_listCommits(provider, dir, limit = 20, hashSize = 10) {
		return new Promise((resolve, reject) => {
			switch (provider.id) {
			case SCM.providers.git:
				// Set working directory
				provider.instance.cwd(dir);

				// Get log from git
				provider.instance.log([
					`-${limit}`
				], (error, status) => {
					if (error) {
						return reject(error);
					}

					if (status && status.all) {
						// Return an array of items for use with the quick pick
						return resolve(status.all.map((commit) => {
							let shortCommit = commit.hash.substring(0, (hashSize - 1)),
								date = new Date(commit.date);

							return {
								label: shortCommit + ' ' + commit.message,
								detail: `${commit.author_name} <${commit.author_email}>` +
									` (${i18n.moment().calendar(date)})`,
								shortCommit,
								baseOption: commit.hash
							};
						}));
					}

					channel.appendLocalisedError('no_commits_for_queue');
					return reject();
				});

				break;

			default:
				reject(new Error('Unknown provider.'));
			}
		});
	}

	/**
	 * Find the Uris affected by a commit.
	 * @param {number} provider - The provider to use. See SCM.providers.
	 * @param {string} dir - The base directory for this operation.
	 * @param {string} commit - The unique commit hash. Will reject with an error
	 * if the commit is not unique.
	 * @returns {Promise} Resolving to an array of Uris.
	 */
	_urisFromCommit(provider, dir, commit) {
		return new Promise((resolve, reject) => {
			switch (provider.id) {
			case SCM.providers.git:
				// Set working directory
				provider.instance.cwd(dir);

				// Get commit details from git
				provider.instance.raw([
					'diff-tree',
					'--no-commit-id',
					'--name-only',
					'-r',
					'--diff-filter=AMRd',
					'-m',
					commit
				], (error, status) => {
					let uris = [];

					if (error) {
						return reject(error);
					}

					if (status && (status = status.trim().split('\n'))) {
						status.forEach((file) => {
							let uri = this.paths.join(
								dir,
								this._cleanGitPath(file)
							);

							if (this.paths.fileExists(uri)) {
								return uris.push(uri);
							}
						});

						resolve(uris);
					}
				});

				break;

			default:
				reject(new Error('Unknown provider.'));
			}
		});
	}

	/**
	 * Return a list of edited Uris given a git status collection
	 * @param {string} dir - The containing directory.
	 * @param {*} status - The status object, passed by simple-git#status.
	 * @returns {Uri[]} - A list of Uris that are edited.
	 */
	_urisFromGitStatus(dir, status) {
		let files = [];

		status.files.forEach((file) => {
			if (file.working_dir === 'D') {
				// Skip deletions
				return false;
			}

			file.uri = vscode.Uri.file(
				this.paths.addTrailingSlash(dir) + this._cleanGitPath(file.path)
			);

			files.push(file.uri);
		});

		return files;
	}

	_cleanGitPath(path) {
		// Remove outer quotes in files with escapeable chars
		path = path.replace(/^"(.*)"$/, '$1');

		// Remove escape characters
		path = path.replace(/\\(?=["'\s])/g, '');

		return path;
	}

	/**
	 * Produces a channel error (either localised or from the raw error).
	 * @param {string} type - Either 'error' or 'info'.
	 * @param {object} provider - Provider data as set by {@link SCM#getProvider}.
	 * @param {string} error - Error string.
	 * @param {...mixed} $3 - Replacement arguments as needed.
	 * @private
	 */
	_appendChannelMessage(type, provider, error) {
		let key,
			stringSet = this._getStringSet(provider.id);

		if (stringSet) {
			// Type needs an uppercase first letter (channel#append[Localised]Type)
			type = type.charAt(0).toUpperCase() + type.slice(1);

			// Find appropriate string (if it exists)
			for (key in stringSet.strings) {
				if (error.includes(stringSet.strings[key])) {
					// Use localised error
					return channel[`appendLocalised${type}`].apply(
						channel,
						[key, [...arguments].slice(3)]
					);
				}
			}
		}

		// Just send error as is
		channel[`append${type}`].apply(channel, [error, [...arguments].slice(3)]);
	}

	/**
	 * Find an appropriate string set to be translated.
	 * @param {number} providerId - One of the SCM.providers IDs
	 */
	_getStringSet(providerId) {
		return SCM.errorStrings.find((set) => {
			return set.provider === providerId;
		});
	}
}

SCM.providers = {
	git: 0
};

/**
 * @description
 * These strings are converted from the original message given by the provider
 * into a language identity string for localised messaging.
 *
 * Each item within `strings` is a key/value pair of locale string references
 * and the message given by the SCM provider.
 * @see {@link SCM#_appendChannelMessage} for implementation.
 */
SCM.errorStrings = [{
	provider: SCM.providers.git,
	strings: {
		'not_a_git_repo': 'fatal: Not a git repository'
	}
}];

module.exports = SCM;
