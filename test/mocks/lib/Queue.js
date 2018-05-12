class Queue {
	constructor() {
		this.tasks = [];
		this.running = false;
	}

	addTask(task) {
		this.tasks.push(task);
	}
}

module.exports = Queue;