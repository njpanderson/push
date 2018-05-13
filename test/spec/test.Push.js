/* global suite, test */

//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
const assert = require('assert');

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
const useMockery = require('../helpers/mockery');
const counter = require('../helpers/counter');
const fixtures = require('../fixtures/general');

const Queue = require('../mocks/lib/Queue');

// Defines a Mocha test suite to group tests of similar kind together
describe('Push', function() {
	let Push;

	useMockery(() => {
		useMockery
			.registerMultiple({
				'vscode': require('../mocks/node/vscode'),
				'./lib/ServiceSettings': require('../mocks/lib/ServiceSettings').sftp,
				'./lib/Service': require('../mocks/lib/Service'),
				'./lib/explorer/Explorer': require('../mocks/lib/Explorer'),
				// './lib/Paths': require('../mocks/lib/Paths'),
				'./lib/queue/Queue': Queue,
				// './lib/queue/QueueTask': {},
				'./lib/Watch': require('../mocks/lib/Watch'),
				'./lib/SCM': require('../mocks/lib/SCM'),
				'./lib/channel': require('../mocks/lib/channel'),
				'./lib/utils': require('../mocks/lib/utils'),
				'./lib/PushBase': require('../mocks/lib/PushBase'),
				'./lang/i18n': require('../mocks/lib/i18n')
			});
	});

	before(() => {
		Push = require('../../src/Push');
		Push.globals.FORCE_STOP_TIMEOUT = 2;
	});

	beforeEach(() => {
		counter.reset();
	});

	// Defines a Mocha unit test
	describe('#didSaveTextDocument', () => {
		it('should return when textDocument has no uri', () => {
			const push = new Push();
			assert(push.didSaveTextDocument({}) === false);
		});

		it('should return when textDocument uri scheme is not valid', () => {
			const push = new Push();
			assert(push.didSaveTextDocument({
				scheme: 'notfile'
			}) === false);
		});

		it('should run queueForUpload when textDocument uri is valid', () => {
			const push = new Push();

			push.queueForUpload = counter.replace(
				'Push#queueForUpload',
				push.queueForUpload,
				() => Promise.resolve()
			);

			push.didSaveTextDocument({
				uri: fixtures.mockUriFile
			});

			assert(counter.getCount('Push#queueForUpload') === 1);
		});
	});

	describe('#queue', () => {
		it('should add an initial function to a new queue', () => {
			const push = new Push();
			push.queue([() => {}]);
			assert(push.queues[Push.queueDefs.default.id].tasks.length === 2);
		});

		it('should not add an initial function to a running queue', () => {
			const push = new Push(),
				queue = push.getQueue(Push.queueDefs.default);

			queue.running = true;
			push.queue([() => { }]);

			assert(push.queues[Push.queueDefs.default.id].tasks.length === 1);
		});

		it('should run the queue immediately when required', () => {
			const push = new Push();

			push.execQueue = counter.bind('Push#execQueue', push.execQueue);
			push.queue([() => { }], true);

			assert(counter.getCount('Push#execQueue') === 1);
		});
	});

	describe('#queueForUpload', () => {
		it('queues a single Uri for uploading', () => {
			const push = new Push();
			return push.queueForUpload(fixtures.mockUriFile)
				.then(() => {
					assert(push.queues[Push.queueDefs.upload.id].tasks.length === 2);
				});
		});

		it('queues Uris for uploading', () => {
			const push = new Push();
			return push.queueForUpload([fixtures.mockUriFile, fixtures.mockUriFile2])
				.then(() => {
					assert(push.queues[Push.queueDefs.upload.id].tasks.length === 3);
				});
		});
	});

	describe('#execUploadQueue', () => {
		it('executes a queue with >0 items', () => {
			const push = new Push();

			push.execQueue = counter.replace('Push#execQueue', push.execQueue, () => {
				return Promise.resolve();
			});

			return push.queueForUpload(fixtures.mockUriFile)
				.then(() => {
					return push.execUploadQueue();
				})
				.then(() => {
					assert(counter.getCount('Push#execQueue') === 1);
				});
		});

		it('writes channel info if queueing is disabled', () => {
			const push = new Push();

			return push.queueForUpload(fixtures.mockUriFile)
				.catch(() => {
					push.config.uploadQueue = false;
					push.execUploadQueue();

					assert(
						counter.getArgs('Channel#appendLocalisedInfo', 1, 0) ===
						'upload_queue_disabled'
					);
				});
		});

		it('shows a warning if queue is empty', () => {
			const push = new Push();

			return push.queueForUpload(fixtures.mockUriFile)
				.catch(() => {
					push.execUploadQueue();

					assert(
						counter.getArgs('utils.showWarning', 1, 0) ===
						'queue_empty'
					)
				});
		});
	});

	describe('#getQueue', () => {
		it('throws without a valid queue', () => {
			const push = new Push();

			assert.throws(() => {
				push.getQueue({});
			});

			assert.throws(() => {
				push.getQueue();
			});
		});

		it('returns a new queue if it doesn\'t exist', () => {
			const push = new Push();

			assert(push.getQueue(fixtures.queueDefinitions.cancellable) instanceof Queue);
		});

		it('returns null if no new queue is desired', () => {
			const push = new Push();

			assert(push.getQueue(fixtures.queueDefinitions.cancellable, false) === null);
		});

		it('returns a queue that exists', () => {
			const push = new Push();

			return push.queueForUpload(fixtures.mockUriFile)
				.then(() => {
					const queue = push.getQueue(Push.queueDefs.upload, false);
					assert(queue instanceof Queue);
					assert(queue.id === 'upload');
				});
		});
	});

	describe('#execQueue', () => {
		it('executes a valid queue', () => {
			const push = new Push();

			push.queue([() => { }]);

			push.execQueue(Push.queueDefs.default)
				.then(() => {
					assert(counter.getCount('Queue#exec') === 1);
				});
		});

		it('returns if a queue is running', () => {
			const push = new Push();

			push.queue([() => { }]);

			return push.execQueue(Push.queueDefs.default)
				.catch((message) => {
					assert(message === 'Queue running.');
				});
		});
	});

	describe('#stopCancellableQueues', () => {
		it('stops all running queues that can be cancelled', () => {
			const push = new Push(),
				cancellable = push.getQueue(Push.queueDefs.default),
				nonCancellable = push.getQueue(Push.queueDefs.upload);

			push.stopQueue = counter.bind('Push#stopQueue');

			cancellable.running = true;
			nonCancellable.running = true;

			return push.stopCancellableQueues()
				.then(() => {
					assert(counter.getCount('Push#stopQueue') === 1);
				});
		});
	});

	describe('#stopQueue', () => {
		it('stops a queue', () => {
			const push = new Push(),
				queue = push.getQueue(Push.queueDefs.default);

			queue.running = true;

			return push.stopQueue(Push.queueDefs.default)
				.then(() => {;
					assert(counter.getCount('Queue#stop') === 1);
					assert(
						counter.getArgs('Channel#appendLocalisedInfo', 1, 0) ===
						'queue_cancelled'
					);
				});
		});

		it('stops a queue silently', () => {
			const push = new Push(),
				queue = push.getQueue(Push.queueDefs.default);

			queue.running = true;
			push.stopQueue(Push.queueDefs.default, false, true)
				.then(() => {
					assert(counter.getCount('Queue#stop') === 1);
					assert(counter.getCount('Channel#appendLocalisedInfo') === 0);
				});
		});

		it('force stops a queue after 2 seconds', () => {
			const push = new Push(),
				queue = push.getQueue(Push.queueDefs.default);

			queue.running = true;

			// Replace Push#service#stop with a promise that never resolves
			push.service.stop = () => new Promise(() => {});

			return push.stopQueue(Push.queueDefs.default, true)
				.catch(() => {
					assert(
						counter.getCount('Service#restartServiceInstance') === 1
					);

					assert(
						counter.getArgs('Channel#appendError', 1, 0) ===
						'queue_force_stopped'
					);
				});

		});
	});
});
