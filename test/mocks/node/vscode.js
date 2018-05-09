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
		executeCommand: counter.count('executeCommand')
	},

	window: {
		activeTextEditor: null,
		onDidChangeActiveTextEditor: () => { }
	},

	workspace: {
		onDidSaveTextDocument: () => { },
		onDidChangeConfiguration: () => { }
	},

	Uri
};