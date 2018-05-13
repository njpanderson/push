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

module.exports = {
	commands: {
		executeCommand: counter.count('vscode.commands.executeCommand')
	},

	window: {
		activeTextEditor: null,
		onDidChangeActiveTextEditor: () => { },
		withProgress: counter.count(
			'vscode.window.withProgress',
			(options, callback) => {
				return new Promise((resolve, reject) => {
					// Bind an empty progress function to be counted
					callback({
						report: counter.bind('vscode.window.withProgress#progress.report')
					})
						.then(resolve, reject);
				});
			},
			this
		)
	},

	workspace: {
		onDidSaveTextDocument: () => { },
		onDidChangeConfiguration: () => { }
	},

	ProgressLocation: {
		window: 0
	},

	Uri
};
