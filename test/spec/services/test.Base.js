/* global suite, test */

//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
const expect = require('chai').expect;

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
const useMockery = require('../../helpers/mockery');
const counter = require('../../helpers/counter');
const fixtures = require('../../fixtures/general');

// Mocks
const vscode = require('../../mocks/node/vscode');

// Defines a Mocha test suite to group tests of similar kind together
describe('Paths', function () {
	let Base, base;

	useMockery(() => {
		useMockery
			.registerMultiple({
				'vscode': vscode,
				'../lib/utils': require('../../mocks/lib/utils'),
				'../lib/channel': require('../../mocks/lib/channel'),
				'../lang/i18n': require('../../mocks/lib/i18n')
			});
	});

	before(() => {
		Base = require('../../../src/services/Base');
	});

	beforeEach(() => {
		counter.reset();
		base = new Base();
	});

	// Defines a Mocha unit test
	describe('#getNonCollidingName', () => {
		it('produces a non-colliding name (filename1-2.txt)', () => {
			expect(base.getNonCollidingName(
				'filename1.txt',
				fixtures.pathCache.list1
			)).to.equal('filename1-2.txt');
		});

		it('produces a non-colliding name (filename2-2.txt)', () => {
			expect(base.getNonCollidingName(
				'filename2.txt',
				fixtures.pathCache.list1
			)).to.equal('filename2-2.txt');
		});

		it('produces a non-colliding name (filename3-2.txt)', () => {
			expect(base.getNonCollidingName(
				'filename3.txt',
				fixtures.pathCache.list1
			)).to.equal('filename3-2.txt');
		});

		it('produces a non-colliding name (filename-1-20-2009-3.ogg)', () => {
			expect(base.getNonCollidingName(
				'filename-1-20-2009.ogg',
				fixtures.pathCache.list2
			)).to.equal('filename-1-20-2009-3.ogg');
		});

		it('produces a non-colliding name (filename1-3.txt)', () => {
			expect(base.getNonCollidingName(
				'filename1.txt',
				fixtures.pathCache.list2
			)).to.equal('filename1-3.txt');
		});

		it('produces a non-colliding name (filename1-2-2.txt)', () => {
			expect(base.getNonCollidingName(
				'filename1-2-2.txt',
				fixtures.pathCache.list2
			)).to.equal('filename1-2-2.txt');
		});

		it('produces a non-colliding name (filename4-4.jpg)', () => {
			expect(base.getNonCollidingName(
				'filename4.jpg',
				fixtures.pathCache.list2
			)).to.equal('filename4-4.jpg');
		});

		it('produces a non-colliding name (filename4-3-2.jpg)', () => {
			expect(base.getNonCollidingName(
				'filename4-3.jpg',
				fixtures.pathCache.list2
			)).to.equal('filename4-3-2.jpg');
		});

		it('produces a non-colliding name (filename6.jpg)', () => {
			expect(base.getNonCollidingName(
				'filename6.jpg',
				fixtures.pathCache.list2
			)).to.equal('filename6.jpg');
		});
	});

});
