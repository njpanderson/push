const vscode = require('vscode');

const utils = require('../lib/utils');

class Queue {
	constructor() {
		this.running = false;
		this.tasks = [];
	}

	/**
	 * Adds a task to the queue
	 * @param {function} fn - Function to add.
	 * @param {string} [actionTaken] - Name of the function/operation performed in
	 * past tense (i.e. "uploaded").
	 */
	addTask(fn, actionTaken) {
		let task = { fn };

		if (actionTaken) {
			task.actionTaken = actionTaken;
		}

		this.tasks.push(task);
	}

	/**
	 * Invokes all stored functions within the queue, returning a promise
	 * @param {string} queueName='default' - Name of the queue to run
	 */
	exec(progressFn) {
		let progressInterval;

		if (this.tasks && this.tasks.length) {
			console.group(`Running ${this.tasks.length} task(s) in queue...`);

			// Start progress interface
			return vscode.window.withProgress({
				location: vscode.ProgressLocation.Window,
				title: 'Push'
			}, (progress) => {
				return new Promise((resolve) => {
					progress.report({ message: 'Processing' });

					// Create an interval to monitor the progressFn function return value
					progressInterval = setInterval(() => {
						let state;

						if (typeof progressFn === 'function' && (state = progressFn())) {
							// Value is defined - write to progress
							progress.report({ message: `Processing ${state}` });
						} else {
							// No value - just use a generic progress
							progress.report({ message: 'Processing' });
						}
					}, 10);

					// Execute all queue items in serial
					this.execQueueItems(
						(results) => {
							console.log('Queue complete', results);
							console.groupEnd();
							clearInterval(progressInterval);
							resolve(results);
						}
					);
				});
			});
		} else {
			return Promise.reject(`Queue is empty.`);
		}
	}

	/**
	 * Executes all items within a queue in serial and invokes the callback on completion.
	 * @param {function} callback - Callback to invoke once the queue is empty
	 * @param {array} results - Results object, populated by queue tasks
	 */
	execQueueItems(callback, results) {
		let task;

		// Initialise the results object
		if (!results) {
			results = {
				success: {},
				fail: {}
			};
		}

		if (this.tasks.length) {
			console.log(`Invoking queue item 0 of ${this.tasks.length}...`);
			// Shift a task off the tasks array
			task = this.tasks.shift();

			// Invoke the function for this task, then get the result
			task.fn()
				.then((result) => {
					// Function/Promise was resolved
					if (result !== false) {
						// Add to success list if the result from the function is anything
						// other than `false`
						console.log('Task result', result);
						if (task.actionTaken) {
							if (!results.success[task.actionTaken]) {
								results.success[task.actionTaken] = [];
							}

							results.success[task.actionTaken].push(result);
						}
					}

					// Loop
					this.execQueueItems(callback, results);
				})
				.catch((error) => {
					// Function/Promise was rejected
					if (error instanceof Error) {
						// Assume thrown errors should stop the queue & alert the user
						if (error === utils.errors.stop) {
							utils.showWarning(error);
						} else {
							utils.showError(error);
						}

						// Empty tasks array
						this.tasks = [];

						// Trigger callback
						callback(results);

						throw error;
					} else if (typeof error === 'string') {
						// Add basic error string to fail list, but don't stop
						if (!results.fail[task.actionTaken]) {
							results.fail[task.actionTaken] = [];
						}

						results.fail[task.actionTaken].push(error);

						// Loop
						this.execQueueItems(callback, results);
					}
				});
		} else {
			// Task queue is empty - send the resuts to the callback and report internally
			this.reportQueueResults(results);
			callback(results);
		}
	}

	/**
	 * Shows a message, reporting on the queue state once completed.
	 * @param {object} results
	 */
	reportQueueResults(results) {
		let actionTaken,
			extra = [
				'Queue complete.'
			];

		for (actionTaken in results.fail) {
			if (results.fail[actionTaken].length === 1) {
				extra.push(`${results.fail[actionTaken].length} item failed.`);
			} else {
				extra.push(`${results.fail[actionTaken].length} items failed.`);
			}
		}

		for (actionTaken in results.success) {
			if (results.success[actionTaken].length === 1) {
				extra.push(`${results.success[actionTaken].length} item ${actionTaken}.`);
			} else {
				extra.push(`${results.success[actionTaken].length} items ${actionTaken}.`);
			}
		}

		if ((Object.keys(results.fail)).length) {
			utils.showWarning(extra.join(' '));
		} else {
			utils.showMessage(extra.join(' '));
		}
	}
};

module.exports = Queue;