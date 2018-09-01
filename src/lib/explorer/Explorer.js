const vscode = require('vscode');

const Item = require('./Item');
const Configurable = require('../Configurable');
const Paths = require('../Paths');

class Explorer extends Configurable {
	constructor() {
		super();

		this.getChildren = this.getChildren.bind(this);

		this.data = {};
		this.paths = new Paths();

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
		if (this.data && data) {
			this.data = Object.assign(this.data, data);
			this._onDidChangeTreeData.fire();
		}
	}

	/**
	 * Get the children nodes of the current tree item (or the top level)
	 * @param {object} element
	 */
	getChildren(element) {
		let top;

		if (typeof element === 'undefined') {
			// Return top level items
			top = [
				new Item('Watching', vscode.TreeItemCollapsibleState.Expanded, {
					icon: 'radio-tower',
					method: 'Watchers'
				})
			];

			if (this.config.uploadQueue) {
				top.push(
					new Item('Upload queue', vscode.TreeItemCollapsibleState.Expanded, {
						icon: 'repo-push',
						method: 'UploadQueue'
					})
				);
			}

			return Promise.resolve(top);
		} else {
			return this['get' + element.method].apply(this, [element]);
		}
	}

	getWatchers() {
		if (this.data.watchList && this.data.watchList.length) {
			return Promise.resolve(
				this.data.watchList.map((watch) => {
					let isFolder = this.paths.isDirectory(watch.uri);

					return new Item(
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
					)
				})
			);
		}

		return Promise.resolve([]);
	}

	getUploadQueue() {
		if (this.data.queues && this.data.queues.upload) {
			return Promise.resolve(
				this.data.queues.upload.tasks.map((task) => {
					if (task.id && task.data.uriContext) {
						return new Item(
							this.paths.getPathWithoutWorkspace(
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

	getTreeItem(element) {
		return element;
	}
}

module.exports = Explorer;
