const vscode = require('vscode');

const Paths = require('../Paths');

const paths = new Paths();

/**
 * Creates a new WatchListItem item.
 * @param {Uri} uri - Uri to watch. Can be either a file or directory.
 * @param {function} callback - Callback function to run on file change.
 * @param {boolean} enable - `true` to enable immediately, `false` otherwise.
 * @constructor
 */
const WatchListItem = function (uri, callback, enable = true) {
	this.uri = uri;
	this.path = paths.getNormalPath(uri);
	this.glob = this._createWatchGlob(uri);
	this.data = {
		triggers: 0
	};
	this.callback = callback;

	enable && this.initWatcher();
};

/**
 * Starts the internal watch process for this item.
 */
WatchListItem.prototype.initWatcher = function () {
	this.watcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(
			vscode.workspace.getWorkspaceFolder(this.uri),
			this.glob
		),
		false,
		false,
		true
	);

	this.watcher.onDidChange(this._watcherChangeApplied.bind(this));
	this.watcher.onDidCreate(this._watcherChangeApplied.bind(this));
};

/**
 * Handle watch change/create events.
 * @param {Uri} uri - Uri context.
 */
WatchListItem.prototype._watcherChangeApplied = function (uri) {
	this.data.triggers += 1;
	this.callback(uri);
};

/**
 * Removes the internal watch process
 */
WatchListItem.prototype.removeWatcher = function () {
	if (this.watcher) {
		this.watcher.dispose();
		this.watcher = null;
	}
};

/**
 * Creates a watch glob given the provided Uri.
 * @param {Uri} uri - Uri to parse.
 */
WatchListItem.prototype._createWatchGlob = function (uri) {
	if (paths.isDirectory(uri)) {
		return paths.ensureGlobPath(
			paths.stripTrailingSlash(
				paths.getPathWithoutWorkspace(uri, vscode.workspace)
			) + '/**/*'
		);
	}

	return paths.ensureGlobPath(
		paths.getPathWithoutWorkspace(uri, vscode.workspace)
	);
};

module.exports = WatchListItem;
