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

			return vscode.window.withProgress({
				location: vscode.ProgressLocation.Window,
				title: 'Push'
			}, (progress) => {
				return new Promise((resolve) => {
					progress.report({ message: 'Processing' });

					progressInterval = setInterval(() => {
						let state;

						if (typeof progressFn === 'function' && (state = progressFn())) {
							progress.report({ message: `Processing ${state}` });
						} else {
							progress.report({ message: 'Processing' });
						}
					}, 10);

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
	 * @param {array} queue
	 * @param {function} callback
	 * @param {array} results
	 */
	execQueueItems(callback, results) {
		let task;

		if (!results) {
			results = {
				success: {},
				fail: {}
			};
		}

		if (this.tasks.length) {
			console.log(`Invoking queue item 0 of ${this.tasks.length}...`);
			task = this.tasks.shift();

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
						utils.showError(error);

						// Empty tasks array
						this.tasks = [];

						// Trigger callback
						callback(results);
					} else if (typeof error === 'string') {
						// Add basic error string to fail list
						if (!results.fail[task.actionTaken]) {
							results.fail[task.actionTaken] = [];
						}

						results.fail[task.actionTaken].push(error);
					}
				});
		} else {
			this.reportQueueResults(results);
			callback(results);
		}
	}

	reportQueueResults(results) {
		let actionTaken, extra = [
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

		utils.showMessage(extra.join(' '));
	}
};

module.exports = Queue;