const vscode = require('vscode');
const path = require('path');

class Item extends vscode.TreeItem {
	constructor(label, collapsibleState, options = {}) {
		super(label, collapsibleState);

		if (options.icon) {
			this.iconPath = {
				light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', options.icon + '.svg'),
				dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', options.icon + '.svg')
			};
		}

		this.contextValue = options.contextValue;
		this.resourceUri = options.resourceUri;
		this.command = options.command;
		this.method = options.method;
	}
}

module.exports = Item;
