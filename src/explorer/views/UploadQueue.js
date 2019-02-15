const vscode = require('vscode');

const TreeItem = require('../TreeItem');
const ExplorerBase = require('../../ExplorerBase');
const paths = require('../../lib/paths');

class UploadQueue extends ExplorerBase {
	constructor() {
		super();
		this.getChildren = this.getChildren.bind(this);
	}

	/**
	 * Get the children nodes of the current tree item
	 * @param {object} element - Unused.
	 */
	getChildren() {
		if (this.data && this.data.upload) {
			return Promise.resolve(
				this.data.upload.tasks.map((task) => {
					if (task.id && task.data.uriContext) {
						return new TreeItem(
							paths.getPathWithoutWorkspace(
								task.data.uriContext,
								vscode.workspace
							),
							vscode.TreeItemCollapsibleState.None,
							{
								icon: 'file',
								resourceUri: task.data.uriContext,
								contextValue: 'uploadQueue:file'
							}
						);
					}
				})
			);
		}

		return Promise.resolve([]);
	}
}

module.exports = UploadQueue;
