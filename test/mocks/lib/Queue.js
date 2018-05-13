const counter = require('../../helpers/counter');

class Queue {
	constructor(id) {
		this.id = id;
		this.tasks = [];
		this.running = false;

		this.exec = counter.count('Queue#exec', this.exec, this);
		this.stop = counter.count('Queue#stop', this.stop, this);
	}

	addTask(task) {
		this.tasks.push(task);
	}

	empty() {
		this.tasks = [];
	}

	exec() {
		return Promise.resolve();
	}

	stop() {
		this.running = false;
		return Promise.resolve();
	}
}

module.exports = Queue;
