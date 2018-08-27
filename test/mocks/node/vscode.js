const counter = require('../../helpers/counter');

class Uri {
	constructor(scheme, authority, path) {
		this.scheme = scheme;
		this.authority = authority;
		this.path = path;
	}
}

Uri.file = (uri) => {
	return new Uri('file', '', uri);
}

class ExtensionContext {
	constructor() {
		this.globalState = new StateMachine();
	}
}

class StateMachine {
	constructor() {
		this.store = {};
	}

	get(key, defaultValue = undefined) {
		return this.store[key] || defaultValue;
	}

	update(key, value) {
		this.store[key] = value;
	}
}

module.exports = {
	commands: {
		executeCommand: counter.attach('vscode.commands.executeCommand')
	},

	window: {
		activeTextEditor: null,
		onDidChangeActiveTextEditor: () => { },
		withProgress: counter.attach(
			'vscode.window.withProgress',
			(options, callback) => {
				return new Promise((resolve, reject) => {
					// Bind an empty progress function to be counted
					callback({
						report: counter.create('vscode.window.withProgress#progress.report')
					})
						.then(resolve, reject);
				});
			},
			this
		),
		showInformationMessage: () => {
			return Promise.resolve('');
		}
	},

	workspace: {
		onDidSaveTextDocument: () => { },
		onDidChangeConfiguration: () => { }
	},

	ProgressLocation: {
		window: 0
	},

	Uri,
	ExtensionContext
};
