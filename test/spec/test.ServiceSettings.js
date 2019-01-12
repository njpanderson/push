/* global suite, test */

//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
const expect = require('chai').expect;

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
const useMockery = require('../helpers/mockery');
const counter = require('../helpers/counter');
const fixtures = require('../fixtures/general');

// Defines a Mocha test suite to group tests of similar kind together
describe('ServiceSettings', function() {
	let ServiceSettings, settings,
		onServiceFileUpdate = counter.create('onServiceFileUpdate');

	useMockery(() => {
		useMockery
			.registerMultiple({
				'vscode': require('../mocks/node/vscode'),
				'./Configurable': require('../mocks/lib/Configurable'),
				'../lib/channel': {},
				'../lib/utils': {},
				'../lang/i18n': require('../mocks/lib/i18n')
			});
	});

	before(() => {
		ServiceSettings = require('../../src/lib/ServiceSettings');
		settings = new ServiceSettings({
			onServiceFileUpdate
		});
	});

	beforeEach(() => {
		counter.reset();
	});

	// Defines a Mocha unit test
	describe('#clear', () => {
		it('should clear the cache', () => {
			settings.settingsCache[fixtures.mockFolder] = {};
			settings.settingsCache[fixtures.mockFolder2] = {};

			settings.clear();

			expect(settings.settingsCache).to.be.empty;
		});

		it('should clear one item in the cache', () => {
			settings.settingsCache[fixtures.mockFolder] = {};
			settings.settingsCache[fixtures.mockFolder2] = { keep: true };

			settings.clear(fixtures.mockFolder);

			expect(settings.settingsCache[fixtures.mockFolder]).to.be.empty;
			expect(settings.settingsCache[fixtures.mockFolder2].keep).to.be.true;
		})
	});

	describe('#getServerJSON', () => {
		it('should get a directory given a file');
		it('should use a cached file if it exists');
		it('should read and set a new file into cache');
	});
});
