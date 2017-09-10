const vscode = require('vscode');

class Queue {
	constructor() {
		this.running = false;
		this.tasks = [];
	}

	addTask(task) {
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
							resolve();
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
	execQueueItems(callback, results = []) {
		let task;

		if (this.tasks.length) {
			console.log(`Invoking queue item 0 of ${this.tasks.length}...`);
			task = this.tasks.shift();

			task()
				.then((result) => {
					// Add to results
					results.push(result);

					// Loop
					this.execQueueItems(callback, results);
				})
				.catch((error) => {
					throw error;
				});
		} else {
			callback(results);
		}
	}
};

module.exports = Queue;