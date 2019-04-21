const vscode = require('vscode');

const ListItem = require('./ListItem');
const Configurable = require('../Configurable');
const Paths = require('../Paths');
const channel = require('../lib/channel');
const constants = require('../lib/constants');
const utils = require('../lib/utils');
const i18n = require('../i18n');

class Watch extends Configurable {
	/**
	 * Class constructor
	 * @param {OutputChannel} channel - Channel for outputting information
	 */
	constructor(stateStorage) {
		super();

		this.watchByWorkspaceFolders = this.recallByWorkspaceFolders.bind(this);

		this.watchList = [];
		this.paths = new Paths();
		this.stateStorage = stateStorage;

		vscode.workspace.onDidChangeWorkspaceFolders((event) => {
			this.recallByWorkspaceFolders(event.added, event.removed);
		});

		/**
		 * Invoked when a watch list updates
		 * @event
		 */
		this.onWatchUpdate = null;

		/**
		 * Invoced every time a watched Uri is triggered
		 * @event
		 */
		this.onChange = null;

		this.status = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left,
			constants.STATUS_PRIORITIES.WATCH
		);

		this.status.command = 'push.listWatchers';
	}

	onDidChangeConfiguration(config, oldConfig) {
		if (config.persistWatchers && !oldConfig.persistWatchers) {
			// persistWatchers is being turned on - add current watchers
			this.watchList.forEach((item) => {
				this.setInWatchStore(item.uri, true, !!(item.watcher));
			});
		}
	}

	/**
	 * @description
	 * Adds or removes stored watchers found to exist within the defined workspace
	 * folder(s). Use `add` to add watchers from the folders, `remove` to remove them.
	 * @param {WorkspaceFolder[]} add - Watchers matching paths within this workspace
	 * will be added.
	 * @param {WorkspaceFolder[]} remove - Watchers matching paths within this
	 * workspace will be removed.
	 */
	recallByWorkspaceFolders() {
		let watchList = this.stateStorage.get(Watch.constants.WATCH_STORE, []),
			args = [...arguments || []];

		if (!this.config.persistWatchers) {
			return;
		}

		['add', 'remove'].forEach((action, i) => {
			args[i] && args[i].forEach((folder) => {
				// Filter watch list by Uris in folder root then add watches
				watchList
					.filter(item => this.paths.pathInUri(
						vscode.Uri.file(item.path),
						folder.uri
					))
					.forEach(item => this[action].apply(this, [
						vscode.Uri.file(item.path),
						item.enabled
					]));
			});
		});
	}

	setInWatchStore(uri, add, enabled = true) {
		let watchList, path, index;

		if (!this.config.persistWatchers) {
			return;
		}

		watchList = this.stateStorage.get(Watch.constants.WATCH_STORE, []);
		path = this.paths.getNormalPath(uri);
		index = watchList.findIndex(item => item.path === path);

		if (add) {
			// Add/update an item
			if (index !== -1) {
				// Just update timestamp
				watchList[index].date = Date.now();
				watchList[index].enabled = enabled;
			} else {
				watchList.unshift({
					path: this.paths.getNormalPath(uri),
					date: (Date.now()),
					enabled
				});
			}

			// Make sure watchList isn't over max items
			if (watchList.length > Watch.constants.WATCH_STORE_MAXLEN) {
				utils.trace(
					'Watch#setInWatchStore',
					`Watch list trunacated (${watchList.length})...`
				);

				// Order by date, descending
				watchList.sort((a, b) => {
					return b.date - a.date;
				});

				// Splice
				watchList.splice((Watch.constants.WATCH_STORE_MAXLEN));
			}
		} else if (index !== -1) {
			// Remove an item (so long as it exists)
			watchList.splice(index, 1);
		}

		this.stateStorage.update(Watch.constants.WATCH_STORE, watchList);
	}

	/**
	 * Add (and activate) a new watcher.
	 * @param {Uri} uri - Uri to start watching.
	 * @param {bool} [enabled=true] - Whether to enable the watcher.
	 */
	add(uri, enabled = true) {
		return new Promise((resolve) => {
			let item;

			if ((item = this.find(uri)) === -1) {
				// Watch doesn't already exist - add a new one
				this.watchList.push(this._createWatch(uri, enabled));
			} else {
				// Watch for this Uri already exists - re-instantiate the watcher
				this.watchList[item].initWatcher();
			}

			this.setInWatchStore(uri, true);

			channel.appendLocalisedInfo('added_watch_for', this.paths.getNormalPath(uri));
			this._updateStatus();

			resolve();
		});
	}

	/**
	 * Remove a watcher by its Uri
	 * @param {Uri} uri - Uri to remove.
	 */
	remove(uri) {
		return new Promise((resolve) => {
			let item;

			if ((item = this.find(uri)) !== -1) {
				this.watchList[item].removeWatcher();
				this.watchList.splice(item, 1);
				channel.appendLocalisedInfo('removed_watch_for', this.paths.getNormalPath(uri));
			}

			this.setInWatchStore(uri, false);

			this._updateStatus();

			resolve();
		});
	}

	/**
	 * Find a watch item by its Uri.
	 * @param {Uri} uri - Uri to find a watch item with.
	 */
	find(uri) {
		let path = this.paths.getNormalPath(uri);
		return this.watchList.findIndex((item) => item.path === path);
	}

	/**
	 * Enable all watchList items that don't have active watchers.
	 * @param {boolean} on - Whether to turn watchers on or not.
	 */
	toggle(on) {
		this.watchList.forEach((item) => {
			if (on) {
				item.initWatcher();
			} else {
				item.removeWatcher();
			}

			this.setInWatchStore(item.uri, true, on);
		});

		this._updateStatus();
	}

	/**
	 * Clear the watch list and their watchers
	 */
	clear() {
		this.watchList.forEach((item) => this.remove(item.uri));
		this.watchList = [];

		channel.appendLocalisedInfo('cleared_all_watchers');
		this._updateStatus();
	}

	/**
	 * Purge all stored watchers (and clear the local watch list)
	 */
	purge() {
		this.clear();
		this.stateStorage.update(Watch.constants.WATCH_STORE, []);
		channel.appendLocalisedInfo('purged_all_watchers');
	}

	/**
	 * List all current watchers.
	 */
	list() {
		if (this.watchList.length) {
			channel.appendLocalisedInfo('watched_paths');

			this.watchList.forEach((item) => {
				channel.appendLine(
					i18n.t('path_with_trigger_count', item.path, item.data.triggers)
				);
			});

			channel.appendLine('');
		} else {
			channel.appendLocalisedInfo('no_paths_watched');
		}

		channel.show();
	}

	/**
	 * Create a watch list item instance.
	 * @param {Uri} uri - Uri to watch.
	 * @param {bool} enable - Whether to enable the watcher item.
	 * @private
	 */
	_createWatch(uri, enable) {
		return new ListItem(
			uri,
			this.onChange,
			enable
		);
	}

	/**
	 * Update the general watcher status.
	 */
	_updateStatus() {
		let active = this.watchList.filter((item) => item.watcher);

		if (active.length) {
			this.status.text = `$(radio-tower) ${active.length}`;
			this.status.show();
		} else {
			this.status.hide();
		}

		this
			._setContext(
				Watch.contexts.hasWatchers,
				!!this.watchList.length
			)
			._setContext(
				Watch.contexts.hasRunningWatchers,
				(active.length > 0)
			)._setContext(
				Watch.contexts.hasStoppedWatchers,
				(
					this.watchList.length > 0 &&
					active.length < this.watchList.length
				)
			);

		if (typeof this.onWatchUpdate === 'function') {
			this.onWatchUpdate(this.watchList);
		}
	}

	/**
	 * Sets the VS Code context for this extension
	 * @param {string} context - Context item name
	 * @param {mixed} value - Context value
	 */
	_setContext(context, value) {
		vscode.commands.executeCommand('setContext', `push:${context}`, value);
		return this;
	}
}

Watch.constants = {
	WATCH_STORE: 'Watch:watchList',
	WATCH_STORE_MAXLEN: 50
};

Watch.contexts = {
	hasRunningWatchers: 'hasRunningWatchers',
	hasStoppedWatchers: 'hasStoppedWatchers',
	hasWatchers: 'hasWatchers',
};

module.exports = Watch;
