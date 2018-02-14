const vscode = require('vscode');

const Paths = require('./Paths');

const paths = new Paths();

const WatchListItem = function (uri, callback) {
	this.uri = uri;
	this.path = paths.getNormalPath(uri);
	this.glob = this._createWatchGlob(uri);
	this.data = {
		triggers: 0
	};
	this.callback = callback;

	this.initWatcher();
}

WatchListItem.prototype.initWatcher = function () {
	this.watcher = vscode.workspace.createFileSystemWatcher(
		this.glob,
		false,
		false,
		true
	);

	this.watcher.onDidChange(this._watcherChangeApplied.bind(this));
	this.watcher.onDidCreate(this._watcherChangeApplied.bind(this));
}

/**
 * Handle watch change/create events.
 * @param {Uri} uri - Uri context.
 */
WatchListItem.prototype._watcherChangeApplied = function (uri) {
	this.data.triggers += 1;
	this.callback(uri);
}

WatchListItem.prototype.removeWatcher = function () {
	if (this.watcher) {
		this.watcher.dispose();
		this.watcher = null;
	}
}

WatchListItem.prototype._createWatchGlob = function (uri) {
	if (paths.isDirectory(uri)) {
		return paths.stripTrailingSlash(paths.getNormalPath(uri)) +
			'/**/*';
	}

	return paths.getNormalPath(uri);
}

module.exports = WatchListItem;
