const vscode = require('vscode');

const WatchListItem = require('./WatchListItem');
const Paths = require('./Paths');
const channel = require('./channel');
const constants = require('./constants');
const i18n = require('../lang/i18n');

class Watch {
	/**
	 * Class constructor
	 * @param {OutputChannel} channel - Channel for outputting information
	 */
	constructor() {
		this.watchList = [];
		this.paths = new Paths();

		/**
		 * Invoked when a watch list updates
		 */
		this.onWatchUpdate = null;

		this.status = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left,
			constants.STATUS_PRIORITIES.WATCH
		);

		this.status.command = 'push.listWatchers';
	}

	/**
	 * Add (and activate) a new watcher.
	 * @param {Uri} uri - Uri to start watching.
	 * @param {function} callback - Callback to fire on change event.
	 */
	add(uri, callback) {
		let item;

		if ((item = this.find(uri)) === -1) {
			// Watch doesn't already exist - add a new one
			this.watchList.push(this._createWatch(uri, callback));
		} else {
			// Watch for this Uri already exists - re-instantiate the watcher
			this.watchList[item].initWatcher();
		}

		channel.appendLocalisedInfo('added_watch_for', this.paths.getNormalPath(uri));
		this._updateStatus();
	}

	/**
	 * Remove a watcher by its Uri
	 * @param {Uri} uri - Uri to remove.
	 */
	remove(uri) {
		let item;

		if ((item = this.find(uri)) !== -1) {
			this.watchList[item].removeWatcher();
			this.watchList.splice(item, 1);
			channel.appendLocalisedInfo('removed_watch_for', this.paths.getNormalPath(uri));
		}

		this._updateStatus();
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
		});

		this._updateStatus();
	}

	/**
	 * Clear the watchList and their watchers
	 */
	clear() {
		this.watchList.forEach((item) => item.removeWatcher());
		this.watchList = [];

		channel.appendLocalisedInfo('cleared_all_watchers');
		this._updateStatus();
	}

	/**
	 * List all current watchers.
	 */
	list() {
		if (this.watchList.length) {
			channel.appendLocalisedInfo("watched_paths");

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
	 * @private
	 */
	_createWatch(uri, callback) {
		return new WatchListItem(
			uri,
			callback
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
};

Watch.contexts = {
	hasRunningWatchers: 'hasRunningWatchers',
	hasStoppedWatchers: 'hasStoppedWatchers',
	hasWatchers: 'hasWatchers',
}

module.exports = Watch;
