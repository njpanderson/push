const vscode = require('vscode');

const Task = require('./Task');
const utils = require('../lib/utils');
const config = require('../lib/config');
const channel = require('../lib/channel');
const TransferResult = require('../Service/TransferResult');
const i18n = require('../i18n');
const {
	STATUS_PRIORITIES,
	QUEUE_LOG_TYPES
} = require('../lib/constants');

class Queue {
	/**
	 * Class constructor
	 * @param {OutputChannel} channel - Channel for outputting information
	 */
	constructor(id, options) {
		this.id = id;
		this.running = false;
		this._tasks = [];
		this.currentTask = null;
		this.progressInterval = null;

		/**
		 * A variable intended to update with the number of tasks within the queue,
		 * which is specifically unmutated during queue execution. Can be used to
		 * track queue progress.
		 */
		this.addedTaskLength = 0;

		this.setOptions(options);

		this.status = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left,
			STATUS_PRIORITIES.UPLOAD_QUEUE
		);

		if (typeof this.options.statusCommand === 'string') {
			this.status.command = this.options.statusCommand;
		}

		// Global progress callbacks for use outside of promises
		this.execProgressReject = null;
	}

	/**
	 * Get all current task (or an empty array)
	 */
	get tasks() {
		return this._tasks;
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
			statusCommand: null,
			emptyOnFail: true
		}, options);
	}

	/**
	 * Adds a task to the end of the current queue.
	 * @param {Task} task - Task to be added.
	 */
	addTask(task) {
		if (!(task instanceof Task)) {
			throw new TypeError('Queue task is not of type Task');
		}

		if (!this.getTask(task.id)) {
			// Only push the task if one doesn't already exist with this id
			this._tasks.push(task);
			this._taskLength = this._tasks.length;
		}

		this._updateStatus();
	}

	/**
	 * Add an array of existing Task instances.
	 * @param {Task[]} tasks - The tasks to add.
	 */
	addTasks(tasks) {
		if (tasks.length === 0) {
			return;
		}

		this._tasks = this._tasks.concat(tasks);
		this._updateStatus();
	}

	/**
	 * Find a task by its Uri. Tasks must have set data.uriContext to be found.
	 * @param {Uri} uri - The Uri to search with.
	 */
	getTaskByUri(uri) {
		return this._tasks.find((task) => {
			return task.data.uriContext && task.data.uriContext.path === uri.path;
		});
	}

	/**
	 * Optimised version of getTaskByUri, intended to only confirm if a task exists.
	 * @param {Uri} uri - The Uri to search with.
	 */
	hasTaskByUri(uri) {
		return ((
			this._tasks.findIndex((task) => {
				return task.data.uriContext && task.data.uriContext.path === uri.path;
			})
		) != -1);
	}

	/**
	 * Remove a task by its ID
	 * @param {string} id - The task ID property
	 */
	removeTask(id) {
		let index = this._tasks.findIndex((task) => task.id === id);

		if (index !== -1) {
			this._tasks.splice(index, 1);
			this._updateStatus();
			return true;
		}

		return false;
	}

	/**
	 * Removes a task by its Uri. Tasks must have set data.uriContext to be found.
	 * @param {Uri} uri
	 */
	removeTaskByUri(uri) {
		let task;

		if ((task = this.getTaskByUri(uri))) {
			this.removeTask(task.id);
		}
	}

	getTask(id) {
		return this._tasks.find((task) => {
			return (task.id !== undefined && task.id === id);
		});
	}

	/**
	 * Starts queue execution, returning a promise.
	 * @param {function} fnProgress - Function to call when requesting progress updates.
	 * @returns {Promise<object>} Resolving when the queue is complete.
	 */
	exec(fnProgress) {
		let lastState;

		// Failsafe to prevent a queue running more than once at a time
		if (this.running) {
			return Promise.reject(i18n.t('queue_running'));
		}

		utils.trace('Queue#exec', 'Queue start', true);

		this._setContext(Queue.contexts.running, true);

		if (this._tasks && this._tasks.length > 1) {
			// Always report one less item (as there's an #init task added by default)
			channel.appendLine(i18n.t('running_tasks_in_queue', (this._tasks.length - 1)));

			// Initialise the results object
			this._initQueueResults();

			// Start progress interface
			return vscode.window.withProgress({
				location: vscode.ProgressLocation.Window,
				title: 'Push'
			}, (progress) => {
				return new Promise((resolve, reject) => {
					let state, currentState, currentTaskNum;

					// Globally assign the rejection function for rejection outside
					// of the promise
					this.execProgressReject = reject;

					progress.report({ message: i18n.t('processing') });

					// Create an interval to monitor the fnProgress function return value
					this.progressInterval = setInterval(() => {
						if (typeof fnProgress === 'function') {
							currentState = fnProgress();
						}

						currentTaskNum = ((this.addedTaskLength - this._tasks.length) + 1);
						state = `${currentState}${currentTaskNum}${this.addedTaskLength}`;

						if (state !== lastState) {
							// Update progress
							if (typeof currentState === 'string') {
								// Value is defined - write to progress
								progress.report({
									message: i18n.t(
										'processing_with_state',
										currentState,
										currentTaskNum,
										this.addedTaskLength
									)
								});
							} else {
								// No value - just use a generic progressing notice
								progress.report({
									message: i18n.t(
										'processing',
										currentTaskNum,
										this.addedTaskLength
									)
								});
							}
						}

						lastState = state;
					}, 10);

					// Execute all queue items in serial
					this.execQueueItems(
						(results) => {
							clearInterval(this.progressInterval);
							this._updateStatus(false);
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
	 * @param {function} fnCallback - Callback to invoke once the queue is empty.
	 * @private
	 */
	execQueueItems(fnCallback) {
		let task;

		if (this._tasks.length) {
			// Further tasks to process
			this.running = true;

			// Get the first task in the queue
			task = this._tasks[0];

			utils.trace(
				'Queue#execQueueItems',
				`Invoking task 0 of ${this._tasks.length} task(s)`
			);

			// Invoke the function for this task, then get the result from its promise
			this.currentTask = task.fn()
				.then((result) => {
					this.currentTask = null;

					if (result instanceof TransferResult) {
						// Result is a TransferResult instance - log the transfer in channel
						channel.appendTransferResult(result);
					}

					if (task.data.actionTaken) {
						// Log the queue result if there is actionTaken data
						if (result instanceof TransferResult) {
							this.logQueueResult(
								result.logType,
								task.data.actionTaken,
								result
							);
						} else {
							this.logQueueResult(
								(result !== false ? QUEUE_LOG_TYPES.success : QUEUE_LOG_TYPES.fail),
								task.data.actionTaken,
								result
							);
						}
					}

					// Loop
					this.loop(fnCallback);
				})
				.catch((error) => {
					this.currentTask = null;

					// Thrown Errors will stop the queue as well as alerting the user
					channel.appendError(error);
					channel.show();

					// Stop queue
					this.stop(true, this.options.emptyOnFail)
						.then(() => this.complete())
						.then(fnCallback);

					throw error;
				});
		} else {
			// Complete queue
			this.complete()
				.then(fnCallback);
			this.reportQueueResults();
		}
	}

	/**
	 * Looper function for #execQueueItems
	 * @param {function} fnCallback - Callback function, as supplied to #execQueueItems.
	 * @param {object} results - Results object, as supplied to #execQueueItems.
	 * @private
	 */
	loop(fnCallback) {
		this._tasks.shift();
		this.execQueueItems(fnCallback);
	}

	/**
	 * Stops a queue by removing all items from it.
	 * @param {boolean} [silent=false] - Use to prevent messaging channel.
	 * @param {boolean} [clearQueue=true] - Empty the queue of all its tasks.
	 * @param {boolean} [force=false] - Force stop, instead of waiting for a currently running task.
	 * @returns {Promise} A promise, eventually resolving when the current task
	 * has completed, or immediately resolved if there is no current task.
	 */
	stop(silent = false, clearQueue = true, force = false) {
		if (this.running) {
			utils.trace('Queue#stop', `Stopping queue (silent: ${silent}, clear: ${clearQueue})`);

			if (!silent) {
				channel.appendInfo(i18n.t('stopping_queue'));
			}

			if (clearQueue) {
				// Remove all pending tasks from this queue
				utils.trace('Queue#stop', 'Emptying tasks');
				this.empty();
			}

			if (this.progressInterval) {
				// Stop the status progress monitor timer
				utils.trace('Queue#stop', 'Stopping progress monitor timer');
				clearInterval(this.progressInterval);
			}

			if (this.execProgressReject) {
				// Reject the globally assigned progress promise (if set)
				utils.trace('Queue#stop', 'Rejecting global progress promise');
				this.execProgressReject();
			}
		}

		if (force) {
			return this.complete();
		}

		if (this.currentTask && this.currentTask instanceof Promise) {
			utils.trace('Queue#stop', 'Returning current task promise');
			return this.currentTask;
		}

		utils.trace('Queue#stop', 'Returning immediately resolving promise');
		return Promise.resolve();
	}

	/**
	 * Invoked on queue completion (regardless of success).
	 * @returns {Promise<object>} Resolved on completion, passing results.
	 */
	complete() {
		return new Promise((resolve) => {
			utils.trace('Queue#complete', 'Queue completion');

			this.running = false;
			this._setContext(Queue.contexts.running, false);

			resolve(this.results);
		});
	}

	/**
	 * Empties the current queue
	 */
	empty() {
		if (this._tasks.length) {
			this._tasks = [];
			this._updateStatus();
			return true;
		}

		return false;
	}

	/**
	 * Initialises the queue results object. Used once per queue run.
	 * @private
	 */
	_initQueueResults() {
		this.results = {
			[QUEUE_LOG_TYPES.success]: {},
			[QUEUE_LOG_TYPES.fail]: {},
			[QUEUE_LOG_TYPES.skip]: {}
		};
	}

	/**
	 * Logs a single queue result.
	 * @param {String} log - One of the QUEUE_LOG_TYPES logs.
	 * @param {String} actionTaken - Localised verb describing the action taken. e.g. 'uploaded'.
	 * @param {*} result - The result data.
	 */
	logQueueResult(log, actionTaken, result) {
		if (!this.results[log][actionTaken]) {
			// Create empty log as none yet exists
			this.results[log][actionTaken] = [];
		}

		// Push result
		this.results[log][actionTaken].push(
			result || null
		);
	}

	/**
	 * Shows a message, reporting on the queue state once completed.
	 */
	reportQueueResults() {
		let actionTaken,
			log,
			extra = [
				i18n.t('queue_complete')
			];

		for (log in QUEUE_LOG_TYPES) {
			for (actionTaken in this.results[QUEUE_LOG_TYPES[log]]) {
				extra.push(i18n.t(
					'queue_items_' + log,
					this.results[QUEUE_LOG_TYPES[log]][actionTaken].length,
					actionTaken
				));
			}
		}


		if ((Object.keys(this.results[QUEUE_LOG_TYPES.fail])).length) {
			// Show a warning in a message window
			utils.showWarning(extra.join(' '));
			channel.show(true);
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
	 * Update the general queue status.
	 * @param {boolean} [updateAddedTasks=true] - Update the 'added tasks' variable.
	 * Not necessary (or wise) to update while the queue is running.
	 */
	_updateStatus(updateAddedTasks = true) {
		let tasks = this._tasks.filter((task) => task.id);

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

		if (updateAddedTasks) {
			this.addedTaskLength = tasks.length;
		}
	}

	/**
	 * Sets the VS Code context for this queue
	 * @param {string} context - Context item name
	 * @param {mixed} value - Context value
	 */
	_setContext(context, value) {
		vscode.commands.executeCommand(
			'setContext',
			`push:queue-${this.id}-${context}`,
			value
		);

		return this;
	}
}

Queue.contexts = {
	itemCount: 'itemCount',
	running: 'running'
};

Queue.Task = Task;

module.exports = Queue;
