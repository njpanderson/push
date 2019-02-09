const vscode = require('vscode');

const TreeItem = require('../TreeItem');
const ExplorerBase = require('../../ExplorerBase');

class WatchList extends ExplorerBase {
	constructor() {
		super();
		this.getChildren = this.getChildren.bind(this);
	}

	/**
	 * Get the children nodes of the current tree item.
	 * @param {object} element - Unused.
	 */
	getChildren() {
		if (this.data && this.data.length) {
			return Promise.resolve(
				this.data.map((watch) => {
					let isFolder = this.paths.isDirectory(watch.uri);

					return new TreeItem(
						this.paths.getPathWithoutWorkspace(
							watch.uri,
							vscode.workspace
						),
						vscode.TreeItemCollapsibleState.None,
						{
							icon: (
								watch.watcher ?
									(isFolder ? 'kebab-horizontal' : 'dot') : 'empty'
							),
							contextValue: (
								isFolder ?
									'watch:folder' : 'watch:file'
							),
							resourceUri: watch.uri
						}
					);
				})
			);
		}

		return Promise.resolve([]);
	}
}

module.exports = WatchList;
