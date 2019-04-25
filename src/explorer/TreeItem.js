const vscode = require('vscode');
const path = require('path');

const { ROOT } = require('../lib/constants');


class TreeItem extends vscode.TreeItem {
	constructor(label, collapsibleState, options = {}) {
		super(label, collapsibleState);

		if (options.icon) {
			this.iconPath = {
				light: path.join(ROOT, 'resources', 'light', options.icon + '.svg'),
				dark: path.join(ROOT, 'resources', 'dark', options.icon + '.svg')
			};
		}

		console.log(path.join(ROOT, 'resources', 'light', options.icon + '.svg'));

		this.contextValue = options.contextValue;
		this.resourceUri = options.resourceUri;
		this.command = options.command;
		this.method = options.method;
	}
}

module.exports = TreeItem;
