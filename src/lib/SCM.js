const vscode = require('vscode');

const channel = require('./channel');
const Paths = require('./Paths');

class SCM {
	constructor() {
		this._paths = new Paths();
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
			return Promise.reject(Error(`Unknown method ${method}`));
		}
	}

	/**
	 * Lists all working files in an array of Uris
	 */
	_listWorkingFiles(provider, dir) {
		return new Promise((resolve, reject) => {
			let files;

			switch (provider.id) {
				case SCM.providers.git:
					provider.instance.cwd(dir);
					provider.instance.status((error, status) => {
						if (error) {
							return reject(error);
						}

						files = this._filesFromGitStatus(dir, status);
						resolve(files);
					})
					break;

				default:
					reject(new Error('Unknown provider.'));
			}
		});
	}

	_filesFromGitStatus(dir, status) {
		return status.files.map((file) => {
			file.uri = vscode.Uri.parse(this._paths.addTrailingSlash(dir) + file.path);
			return file;
		})
	}

	/**
	 * Produces a channel error (either localised or from the raw error).
	 * @param {string} type - Either 'error' or 'info'.
	 * @param {object} provider - Provider data as set by {@link SCM#getProvider}.
	 * @param {string} error - Error string.
	 * @param {...mixed} $3 - Replacement arguments as needed.
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

SCM.errorStrings = [{
	provider: SCM.providers.git,
	strings: {
		'not_a_git_repo': 'fatal: Not a git repository'
	}
}];

module.exports = SCM;