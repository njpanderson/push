const vscode = require('vscode');

const Push = require('./Push');

/**
 * Provides a normalised interface for the command panel and contextual menus.
 */
class PushCommand {
	constructor() {
		this.upload = this.upload.bind(this);
		this.download = this.download.bind(this);

		this._push = new Push();
		this._queue = {
			command: []
		};
	}

	/**
	 * Routes to a Push method after doing required up-front work.
	 * @param {string} method - Method name to execute
	 * @param {object} uriContext - Contextual file URI (or blank if none)
	 */
	_route(method, uriContext, args, runImmediately = false, queueName = 'command') {
		// Queue the push method
		this._queue[queueName].push(() => {
			// Set the current URI context
			console.log(`Running queue entry ${method}...`);
			if (this._push.model.setUriContext(uriContext)) {
				// Apply the method
				return this._push[method].apply(this._push, args);
			}
		});

		if (runImmediately) {
			return this.execQueue(queueName);
		}
	}

	/**
	 * Invokes all stored functions within the queue, returning a promise
	 * @param {string} queueName='command' - Name of the queue to run
	 */
	execQueue(queueName = 'command') {
		let progressInterval;

		if (this._queue[queueName]) {
			console.log(`Running ${this._queue[queueName].length} task(s) in queue...`);

			vscode.window.withProgress({
				location: vscode.ProgressLocation.Window,
				title: 'Push'
			}, (progress) => {
				return new Promise((resolve) => {
					console.log('Progress queue');
					progress.report({ message: 'Processing' });

					progressInterval = setInterval(() => {
						console.log('Tick');
						if (this.push.model.service.progress !== null) {
							progress.report({ message: 'Processing ' + this.push.model.service.progress });
						} else {
							progress.report({ message: 'Processing' });
						}
					}, 10);

					this._queue[queueName].forEach((item) => item());

					return Promise.all(this._queue[queueName])
						.then(() => {
							console.log('Queue done');
							clearInterval(progressInterval);
							this._queue[queueName] = [];
							resolve();
						});
				});
			});
		} else {
			return Promise.reject(`Queue name ${queueName} not found.`);
		}
	}

	upload(src) {
		return this._route('upload', src, [], true);
	}

	download(src) {
		return this._route('download', src, [], true);
	}
}

module.exports = PushCommand;