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
				'./lib/queue/Queue': require('../mocks/lib/Queue'),
				// './lib/queue/QueueTask': {},
				'./lib/Watch': require('../mocks/lib/Watch'),
				'./lib/SCM': require('../mocks/lib/SCM'),
				'./lib/channel': require('../mocks/lib/channel'),
				'./lib/utils': {},
				'./lib/PushBase': require('../mocks/lib/PushBase'),
				'./lang/i18n': require('../mocks/lib/i18n')
			});
	});

	before(() => {
		Push = require('../../src/Push');
	});

	beforeEach(() => {
		counter.reset();
	});

	// Defines a Mocha unit test
	describe('#didSaveTextDocument', () => {
		it('should return when textDocument has no uri', () => {
			let push = new Push();
			assert(push.didSaveTextDocument({}) === false);
		});

		it('should return when textDocument uri scheme is not valid', () => {
			let push = new Push();
			assert(push.didSaveTextDocument({
				scheme: 'notfile'
			}) === false);
		});

		it('should run queueForUpload when textDocument uri is valid', () => {
			let push = new Push();

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
			let push = new Push();
			push.queue([() => {}]);
			assert(push.queues[Push.queueDefs.default.id].tasks.length === 2);
		});

		it('should not add an initial function to a running queue', () => {
			let push = new Push(),
				queue = push.getQueue(Push.queueDefs.default);
			queue.running = true;
			push.queue([() => { }]);
			assert(push.queues[Push.queueDefs.default.id].tasks.length === 1);
		});

		it('should run the queue immediately when required', () => {
			let push = new Push();
			push.execQueue = counter.replace('Push#execQueue', push.execQueue);
			push.queue([() => { }], true);
			assert(counter.getCount('Push#execQueue') === 1);
		});
	});

	describe('#queueForUpload', () => {
		it('queues a single Uri for uploading', () => {
			let push = new Push();
			return push.queueForUpload(fixtures.mockUriFile)
				.then(() => {
					assert(push.queues[Push.queueDefs.upload.id].tasks.length === 2);
				});
		});

		it('queues Uris for uploading', () => {
			let push = new Push();
			return push.queueForUpload([fixtures.mockUriFile, fixtures.mockUriFile2])
				.then(() => {
					assert(push.queues[Push.queueDefs.upload.id].tasks.length === 3);
				});
		});
	});

	describe('#execUploadQueue', () => {
		it('writes channel info if queueing is disabled', () => {
			let push = new Push();
			return push.queueForUpload(fixtures.mockUriFile)
				.then(() => {
					push.config.uploadQueue = false;
					push.execUploadQueue();

					assert(
						counter.getArgs('Channel#appendLocalisedInfo', 1, 0) ===
						'upload_queue_disabled'
					);
				});
		});

		it('executes a queue with >0 items');
		it('shows a warning if queue is empty');
	});
});