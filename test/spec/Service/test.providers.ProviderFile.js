const expect = require('chai').expect;

const useMockery = require('../../helpers/mockery');
const counter = require('../../helpers/counter');
const fixtures = require('../../fixtures/general');

// Mocks
const vscode = require('../../mocks/node/vscode');

describe('Service/providers/ProviderFile', function () {
	let File, file;

	useMockery(() => {
		useMockery
			.registerMultiple({
				'vscode': vscode,
				'./lib/channel': require('../../mocks/lib/channel'),
				'../../i18n': require('../../mocks/lib/i18n')
			});
	});

	before(() => {
		File = require('../../../src/Service/providers/ProviderFile');
	});

	beforeEach(() => {
		counter.reset();
		file = new File();
	});

	describe('#convertUriToRemote', () => {
		it(`converts a local Uri (${fixtures.services.File.local.uri.path}) to a remote path (${fixtures.services.File.remote.path})`, () => {
			file.config.service = fixtures.services.File.serviceData.data.default.options;
			file.config.serviceFile = fixtures.services.File.serviceData.file;

			expect(file.convertUriToRemote(
				fixtures.services.File.local.uri
			)).to.equal(
				fixtures.services.File.remote.path
			);
		});

		it(`converts a local Uri (${fixtures.services.File.local.subUri.path}) to a remote path (${fixtures.services.File.remote.subPath})`, () => {
			file.config.service = fixtures.services.File.serviceData.data.default.options;
			file.config.serviceFile = fixtures.services.File.serviceData.file;

			expect(file.convertUriToRemote(
				fixtures.services.File.local.subUri
			)).to.equal(
				fixtures.services.File.remote.subPath
			);
		});
	});

	describe('#convertRemoteToUri', () => {
		it(`converts a remote path (${fixtures.services.File.remote.path}) to a local Uri (${fixtures.services.File.local.uri.path})`, () => {
			file.config.service = fixtures.services.File.serviceData.data.default.options;
			file.config.serviceFile = fixtures.services.File.serviceData.file;

			expect(file.convertRemoteToUri(
				fixtures.services.File.remote.path
			)).to.eql(
				fixtures.services.File.local.uri
			);
		});

		it(`converts a remote path (${fixtures.services.File.remote.subPath}) to a local Uri (${fixtures.services.File.local.subUri.path})`, () => {
			file.config.service = fixtures.services.File.serviceData.data.default.options;
			file.config.serviceFile = fixtures.services.File.serviceData.file;

			expect(file.convertRemoteToUri(
				fixtures.services.File.remote.subPath
			)).to.eql(
				fixtures.services.File.local.subUri
			);
		});
	});

});
