const path = require('path');

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

class StatusBarItem {
	constructor() {
		this.show = counter.attach('vscode.StatusBarItem.show');
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
		createStatusBarItem: () => {
			return new StatusBarItem();
		},
		showInformationMessage: () => {
			return Promise.resolve('');
		}
	},

	workspace: {
		onDidSaveTextDocument: () => { },
		onDidChangeConfiguration: () => { },
		workspaceFolders: [{
			name: 'Mocked Workspace Folder',
			uri: Uri.file(path.dirname(path.dirname(__dirname)) + '/fixtures/transfer')
		}]
	},

	ProgressLocation: {
		window: 0
	},

	Uri,
	ExtensionContext,
	StatusBarItem,

	StatusBarAlignment: {
		Left: 1,
		Right: 2
	}
};
