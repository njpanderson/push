const expect = require('chai').expect;

const useMockery = require('../../helpers/mockery');
const counter = require('../../helpers/counter');
const fixtures = require('../../fixtures/general');

describe('Service/ServiceSettings', function() {
	let ServiceSettings, settings,
		onServiceFileUpdate = counter.create('onServiceFileUpdate');

	useMockery(() => {
		useMockery
			.registerMultiple({
				'vscode': require('../../mocks/node/vscode'),
				'../../Configurable': require('../../mocks/lib/Configurable'),
				'../../lib/channel': {},
				'../../lib/utils': {},
				'../../i18n': require('../../mocks/lib/i18n')
			});
	});

	before(() => {
		ServiceSettings = require('../../../src/Service/ServiceSettings');
		settings = new ServiceSettings({
			onServiceFileUpdate
		});
	});

	beforeEach(() => {
		counter.reset();
	});

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
		});
	});

	describe('#getServerJSON', () => {
		it('should get a directory given a file');
		it('should use a cached file if it exists');
		it('should read and set a new file into cache');
	});
});
