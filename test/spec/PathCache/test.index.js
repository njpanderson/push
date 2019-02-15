/* global suite, test */
const expect = require('chai').expect;
const path = require('path');

const useMockery = require('../../helpers/mockery');
const counter = require('../../helpers/counter');
const fixtures = require('../../fixtures/general');

// Mocks
const vscode = require('../../mocks/node/vscode');

describe('PathCache', function() {
	let PathCache, pathcache;

	useMockery(() => {
		useMockery
			.registerMultiple({
				'vscode': vscode,
				'../i18n': require('../../mocks/lib/i18n'),
				'../lib/channel': require('../../mocks/lib/channel'),
				'../lib/utils': require('../../mocks/lib/utils'),
				'../../lib/utils': require('../../mocks/lib/utils')
			});
	});

	before(() => {
		PathCache = require('../../../src/PathCache');
	});

	beforeEach(() => {
		counter.reset();
		pathcache = new PathCache();
	});

	describe('#listDirectory', () => {
		it('should list a directory', () => {
			return pathcache.listDirectory(fixtures.mockFolder)
				.then((list) => {
					const test = [];

					list.forEach((item) => {
						test.push({
							name: item.name,
							pathName: item.pathName,
							type: item.type
						});
					});

					expect(test).to.include.deep.members([{
						name: '.hidden-file',
						pathName: path.join(
							path.dirname(path.dirname(__dirname)), 'fixtures', 'transfer', 'test-folder', '.hidden-file'
						),
						type: 'f'
					}, {
						name: 'another-test-subfile.txt',
						pathName: path.join(
							path.dirname(path.dirname(__dirname)), 'fixtures', 'transfer', 'test-folder', 'another-test-subfile.txt'
						),
						type: 'f'
					}, {
						name: 'test-subfile.txt',
						pathName: path.join(
							path.dirname(path.dirname(__dirname)), 'fixtures', 'transfer', 'test-folder', 'test-subfile.txt'
						),
						type: 'f'
					}]);
				});
		});
	});
});
