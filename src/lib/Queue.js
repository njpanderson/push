const vscode = require('vscode');
const crypto = require('crypto');

const utils = require('./utils');
const config = require('./config');
const channel = require('./channel');
const constants = require('./constants');
const i18n = require('../lang/i18n');

class Queue {
	/**
	 * Class constructor
	 * @param {OutputChannel} channel - Channel for outputting information
	 */
	constructor(id, options) {
		this.id = id;
		this.running = false;
		this.tasks = [];
		this.currentTask = null;
		this.progressInterval = null;

		this.setOptions(options);

		this.status = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left,
			constants.STATUS_PRIORITIES.UPLOAD_QUEUE
		);

		if (typeof this.options.statusCommand === 'string') {
			this.status.command = this.options.statusCommand;
		}

		// Global progress callbacks for external use
		this.progressReject = null;
	}

	/**
	 * Set class-specific options.
	 * @param {object} options
	 */
	setOptions(options) {
		this.options = Object.assign({}, {
			showStatus: false,
			statusIcon: 'repo-push',
			statusToolTip: null,
			statusCommand: null
		}, options);
	}

	/**
	 * Adds a task to the queue
	 * @param {function} fn - Function to add.
	 * @param {object} [data] - Queue metadata:
	 *  - `actionTaken` Name of the function/operation performed in past tense
	 *     (i.e. "uploaded").
	 *  - `id` Identifier for the task.
	 *  - `uriContext` Contextual URI for the task.
	 */
	addTask(fn, data) {
		let hash = crypto.createHash('sha256'),
			task = { fn };

		// Hash the ID
		if (data && data.id) {
			hash.update(data.id);
			data.id = hash.digest('hex');
		}

		if ((!data || data.id === undefined) || !this.getTask(data.id)) {
			// Only push the task if one doesn't already exist with this id
			this.tasks.push(
				Object.assign(task, data)
			);
		}

		this._updateStatus();
	}

	getTask(id) {
		return this.tasks.find((item) => {
			return ('id' in item && item.id === id);
		})
	}

	/**
	 * Get all current task (or an empty array)
	 */
	getTasks() {
		return this.tasks;
	}

	/**
	 * Invokes all stored functions within the queue, returning a promise
	 * @param {function} fnProgress - Function to call when requesting progress updates.
	 */
	exec(fnProgress) {
		if (this.tasks && this.tasks.length) {
			// Always report one less item (as there's an #init task added by default)
			channel.appendLine(i18n.t('running_tasks_in_queue', (this.tasks.length - 1)));

			// Start progress interface
			return vscode.window.withProgress({
				location: vscode.ProgressLocation.Window,
				title: 'Push'
			}, (progress) => {
				return new Promise((resolve, reject) => {
					// Globally assign the rejection function for rejection outside
					// of the promise
					this.progressReject = reject;

					progress.report({ message: i18n.t('processing') });

					// Create an interval to monitor the fnProgress function return value
					this.progressInterval = setInterval(() => {
						let state;

						if (typeof fnProgress === 'function') {
							state = fnProgress();
						}

						if (typeof state === 'string') {
							// Value is defined - write to progress
							progress.report({ message: i18n.t('processing_with_state', state) });
						} else {
							// No value - just use a generic progressing notice
							progress.report({ message: i18n.t('processing') });
						}
					}, 10);

					// Execute all queue items in serial
					this.execQueueItems(
						(results) => {
							clearInterval(this.progressInterval);
							this._updateStatus();
							resolve(results);
						}
					);
				});
			});
		} else {
			return Promise.reject(i18n.t('queue_empty'));
		}
	}

	/**
	 * Executes all items within a queue in serial and invokes the callback on completion.
	 * @param {function} fnCallback - Callback to invoke once the queue is empty
	 * @param {array} results - Results object, populated by queue tasks
	 */
	execQueueItems(fnCallback, results) {
		let task;

		// Initialise the results object
		if (!results) {
			results = {
				success: {},
				fail: {}
			};
		}

		if (this.tasks.length) {
			// Further tasks to process
			this.running = true;

			// Shift a task off the tasks array
			task = this.tasks.shift();

			// Invoke the function for this task, then get the result from its promise
			this.currentTask = task.fn()
				.then((result) => {
					// Function/Promise was resolved
					if (result !== false) {
						// Add to success list if the result from the function is anything
						// other than `false`
						if (task.actionTaken) {
							if (!results.success[task.actionTaken]) {
								results.success[task.actionTaken] = [];
							}

							results.success[task.actionTaken].push(result);
						}
					}

					// Loop
					this.execQueueItems(fnCallback, results);
				})
				.catch((error) => {
					// Function/Promise was rejected
					if (error instanceof Error) {
						// Thrown Errors will stop the queue as well as alerting the user
						channel.appendError(error);
						channel.show();

						// Empty tasks array
						this.tasks = [];

						// Trigger callback
						fnCallback(results);

						throw error;
					} else if (typeof error === 'string') {
						// String based errors add to fail list, but don't stop
						if (!results.fail[task.actionTaken]) {
							results.fail[task.actionTaken] = [];
						}

						results.fail[task.actionTaken].push(error);

						channel.appendError(error);

						// Loop
						this.execQueueItems(fnCallback, results);
					}
				});
		} else {
			// Task queue is empty - send the resuts to the callback and report internally
			this.running = false;

			this.reportQueueResults(results);
			fnCallback(results);
		}
	}

	/**
	 * Stops a queue by removing all items from it.
	 * @returns {promise} - A promise, eventually resolving when the current task
	 * has completed, or immediately resolved if there is no current task.
	 */
	stop() {
		if (this.tasks.length && this.running && this.progressReject) {
			channel.appendInfo(i18n.t('stopping_queue'));

			// Remove all pending tasks from this queue
			this.tasks = [];

			if (this.progressInterval) {
				clearInterval(this.progressInterval);
			}

			// Reject the globally assigned progress promise
			this.progressReject();
		}

		return this.currentTask || Promise.resolve();
	}

	/**
	 * Shows a message, reporting on the queue state once completed.
	 * @param {object} results
	 */
	reportQueueResults(results) {
		let actionTaken,
			extra = [
				i18n.t('queue_complete')
			];

		for (actionTaken in results.fail) {
			if (results.fail[actionTaken].length) {
				channel.show(true);
			}

			extra.push(i18n.t('queue_items_failed', results.fail[actionTaken].length));
		}

		for (actionTaken in results.success) {
			extra.push(i18n.t(
				'queue_items_actioned',
				results.success[actionTaken].length,
				actionTaken
			));
		}

		if ((Object.keys(results.fail)).length) {
			// Show a warning in a message window
			utils.showWarning(extra.join(' '));
		} else {
			if (config.get('queueCompleteMessageType') === 'status') {
				// Show completion in the status bar
				utils.showStatusMessage('$(issue-closed) ' + extra.join(' '), 2);
			} else {
				// Show completion in a message window
				utils.showMessage(extra.join(' '));
			}

		}
	}

	/**
	 * Update the general watcher status.
	 */
	_updateStatus() {
		let tasks = this.tasks.filter((task) => task.id);

		this._setContext(Queue.contexts.itemCount, tasks.length);

		if (tasks.length && this.options.showStatus) {
			this.status.text = `$(${this.options.statusIcon}) ${tasks.length}`;

			if (typeof this.options.statusToolTip === 'function') {
				this.status.tooltip = this.options.statusToolTip(tasks.length);
			}

			this.status.show();
		} else {
			this.status.hide();
		}
	}

	/**
	 * Sets the VS Code context for this extension
	 * @param {string} context - Context item name
	 * @param {mixed} value - Context value
	 */
	_setContext(context, value) {
		console.log(`Setting queue context: push:queue-${this.id}-${context} to "${value}"`);
		vscode.commands.executeCommand('setContext', `push:queue-${this.id}-${context}`, value);
		return this;
	}
};

Queue.contexts = {
	itemCount: 'itemCount'
}

module.exports = Queue;
