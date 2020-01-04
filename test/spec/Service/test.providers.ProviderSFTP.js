const expect = require('chai').expect;

const useMockery = require('../../helpers/mockery');
const counter = require('../../helpers/counter');
const fixtures = require('../../fixtures/general');

// Mocks
const vscode = require('../../mocks/node/vscode');

describe('Service/providers/ProviderSFTP', function () {
	let SFTP, sftp;

	useMockery(() => {
		useMockery
			.registerMultiple({
				'vscode': vscode,
				'../../lib/channel': require('../../mocks/lib/channel'),
				'./lib/channel': require('../../mocks/lib/channel'),
				'../../i18n': require('../../mocks/lib/i18n')
			});
	});

	before(() => {
		SFTP = require('../../../src/Service/providers/ProviderSFTP');
	});

	beforeEach(() => {
		counter.reset();
		sftp = new SFTP();
	});

	describe('#convertUriToRemote', () => {
		it(`converts a local Uri (${fixtures.services.SFTP.local.uri.path}) to a remote path (${fixtures.services.SFTP.remote.path})`, () => {
			sftp.config.service = fixtures.services.SFTP.serviceData.data.default.options;
			sftp.config.serviceFile = fixtures.services.SFTP.serviceData.file;

			expect(sftp.convertUriToRemote(
				fixtures.services.SFTP.local.uri
			)).to.equal(
				fixtures.services.SFTP.remote.path
			);
		});

		it(`converts a local Uri (${fixtures.services.SFTP.local.subUri.path}) to a remote path (${fixtures.services.SFTP.remote.subPath})`, () => {
			sftp.config.service = fixtures.services.SFTP.serviceData.data.default.options;
			sftp.config.serviceFile = fixtures.services.SFTP.serviceData.file;

			expect(sftp.convertUriToRemote(
				fixtures.services.SFTP.local.subUri
			)).to.equal(
				fixtures.services.SFTP.remote.subPath
			);
		});
	});

	describe('#convertRemoteToUri', () => {
		it(`converts a remote path (${fixtures.services.SFTP.remote.subPath}) to a local Uri (${fixtures.services.SFTP.local.subUri.path})`, () => {
			sftp.config.service = fixtures.services.SFTP.serviceData.data.default.options;
			sftp.config.serviceFile = fixtures.services.SFTP.serviceData.file;

			expect(sftp.convertRemoteToUri(
				fixtures.services.SFTP.remote.subPath
			)).to.eql(
				fixtures.services.SFTP.local.subUri
			);
		});
	});

});
