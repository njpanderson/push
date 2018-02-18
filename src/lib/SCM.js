const vscode = require('vscode');

class SCM {
	constructor() {
		this._provider = {
			id: null,
			dir: null,
			instance: null
		};
	}

	getProvider(provider, dir) {
		if (this._provider.id === provider && this._provider.dir === dir) {
			// Provider ID/dir is unchanged - just return
			return this._provider.instance;
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

		return this._provider.instance;
	}

	/**
	 * Lists all working files in an array of Uris
	 */
	listWorkingFiles(provider, dir) {
		return new Promise((resolve, reject) => {
			let files;

			provider = this.getProvider(provider, dir);

			switch (this._provider) {
				case SCM.providers.git:
					provider.instance.cwd(dir);
					provider.instance.status((status) => {
						files = this.filesFromGitStatus(status);
						resolve(files);
					})
					break;
			}

			reject();
		});
	}

	filesFromGitStatus(status) {
		console.log(status);
		return status;
	}
}

SCM.providers = {
	git: 0
};

module.exports = SCM;