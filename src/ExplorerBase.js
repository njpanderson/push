const vscode = require('vscode');

const Configurable = require('./Configurable');

class ExplorerBase extends Configurable {
	constructor() {
		super();

		this.data = null;

		this._onDidChangeTreeData = new vscode.EventEmitter();
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
	}

	onDidChangeConfiguration() {
		this.refresh();
	}

	/**
	 * Refresh by firing the change event - will run getChildren etc again
	 */
	refresh(data) {
		if (data) {
			if (Array.isArray(data)) {
				this.data = [...data];
			} else {
				this.data = {...data};
			}

			this._onDidChangeTreeData.fire();
		}
	}

	getTreeItem(element) {
		return element;
	}
}

module.exports = ExplorerBase;
