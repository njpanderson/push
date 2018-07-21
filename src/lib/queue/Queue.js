const vscode = require('vscode');

const QueueTask = require('./QueueTask');
const utils = require('../utils');
const config = require('../config');
const channel = require('../channel');
const constants = require('../constants');
const i18n = require('../../lang/i18n');

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
			constants.STATUS_PRIORITIES.UPLOAD_QUEUE
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
	 * @param {QueueTask} task - Task to be added.
	 */
	addTask(task) {
		if (!(task instanceof QueueTask)) {
			throw new TypeError('Queue task is not of type QueueTask');
		}

		if (!this.getTask(task.id)) {
			// Only push the task if one doesn't already exist with this id
			this._tasks.push(task);
			this._taskLength = this._tasks.length;
		}

		this._updateStatus();
	}

	/**
	 * Add an array of existing QueueTask instances.
	 * @param {QueueTask[]} tasks - The tasks to add.
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
		})
	}

	/**
	 * Starts queue execution, returning a promise.
	 * @param {function} fnProgress - Function to call when requesting progress updates.
	 * @returns {promise} Resolving when the queue is complete.
	 */
	exec(fnProgress) {
		let lastState;

		// Failsafe to prevent a queue running more than once at a time
		if (this.running) {
			return Promise.reject(i18n.t('queue_running'));
		}

		this._setContext(Queue.contexts.running, true);

		if (this._tasks && this._tasks.length) {
			// Always report one less item (as there's an #init task added by default)
			channel.appendLine(i18n.t('running_tasks_in_queue', (this._tasks.length - 1)));

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

		if (this._tasks.length) {
			// Further tasks to process
			this.running = true;

			// Get the first task in the queue
			task = this._tasks[0];

			// Invoke the function for this task, then get the result from its promise
			this.currentTask = task.fn()
				.then((result) => {
					this.currentTask = null;

					// Function/Promise was resolved
					if (result !== false) {
						// Add to success list if the result from the function is anything
						// other than `false`
						if (task.data.actionTaken) {
							if (!results.success[task.data.actionTaken]) {
								results.success[task.data.actionTaken] = [];
							}

							results.success[task.data.actionTaken].push(result);
						}
					}

					// Loop
					this._loop(fnCallback, results);
				})
				.catch((error) => {
					// Function/Promise was rejected
					this.currentTask = null;

					if (error instanceof Error) {
						// Thrown Errors will stop the queue as well as alerting the user
						channel.appendError(error);
						channel.show();

						// Stop queue
						this.stop(true, this.options.emptyOnFail)
							.then(() => {
								this.complete(results, fnCallback);
							});

						throw error;
					} else if (typeof error === 'string') {
						// String based errors add to fail list, but don't stop
						if (!results.fail[task.data.actionTaken]) {
							results.fail[task.data.actionTaken] = [];
						}

						results.fail[task.data.actionTaken].push(error);

						channel.appendError(error);

						// Loop
						this._loop(fnCallback, results);
					}
				});
		} else {
			// Complete queue
			this.complete(results, fnCallback);
			this.reportQueueResults(results);
		}
	}

	/**
	 * Looper function for #execQueueItems
	 * @param {function} fnCallback - Callback function, as supplied to #execQueueItems.
	 * @param {object} results - Results object, as supplied to #execQueueItems
	 */
	_loop(fnCallback, results) {
		this._tasks.shift();
		this.execQueueItems(fnCallback, results);
	}

	/**
	 * Stops a queue by removing all items from it.
	 * @returns {promise} - A promise, eventually resolving when the current task
	 * has completed, or immediately resolved if there is no current task.
	 */
	stop(silent = false, clearQueue = true) {
		if (this.running) {
			if (!silent) {
				// If this stop isn't an intentional use action, let's allow
				// for silence here.
				channel.appendInfo(i18n.t('stopping_queue'));
			}

			if (clearQueue) {
				// Remove all pending tasks from this queue
				this.empty();
			}

			if (this.progressInterval) {
				// Stop the status progress monitor timer
				clearInterval(this.progressInterval);
			}

			if (this.execProgressReject) {
				// Reject the globally assigned progress promise (if set)
				this.execProgressReject();
			}
		}

		return this.currentTask || Promise.resolve();
	}

	/**
	 * Invoked on queue completion (regardless of success).
	 * @param {mixed} results - Result data from the queue process
	 * @param {function} fnCallback - Callback function to invoke
	 */
	complete(results, fnCallback) {
		this.running = false;
		this._setContext(Queue.contexts.running, false);

		if (typeof fnCallback === 'function') {
			fnCallback(results);
		}
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
};

Queue.contexts = {
	itemCount: 'itemCount',
	running: 'running'
}

module.exports = Queue;
