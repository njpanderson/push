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
describe('Paths', function() {
    let Paths, paths;

    useMockery(() => {
        useMockery
            .registerMultiple({
                'vscode': require('../mocks/node/vscode')
            });
    });

    before(() => {
        Paths = require('../../src/lib/Paths');
    });

    beforeEach(() => {
        counter.reset();
        paths = new Paths();
    });

    // Defines a Mocha unit test
    describe('#fileExists', () => {
        it('should return whether a Uri exists', () => {
            assert(paths.fileExists(fixtures.mockUriFile) === true);
        });
        it('should return false if a non-file Uri is passed', () => {
            assert(paths.fileExists(fixtures.mockForeignSchemeFile) === false);
        });
    });

    describe('#getNormalPath', () => {
        it('should return a normalised (string) version of a Uri', {

        });
    });

    describe('#getPathWithoutWorkspace', () => {
        it('should return a Uri normalised without workspace path');
    });

    describe('#stripTrailingSlash', () => {
        it('should strip a trailing slash');
        it('should ignore no trailing slash exists');
    });

    describe('#addTrailingSlash', () => {
        it('should add exactly one trailing slash');
        it('should ignore if a trailing slash exists');
    });

    describe('#isDirectory', () => {
        it('should confirm a string directory');
        it('should confirm a Uri directory');
    });

    describe('#listDirectory (tests pending documentation)', () => {
    });

    describe('#getDirectoryContentsAsFiles', () => {
        describe('With a Uri', () => {
            it('should list all files within the directory');
        });

        describe('With a glob string', () => {
            it('should list all files within the directory');
        });

        describe('With an array', () => {
            it('should list all files within the directory');
        });
    });

    describe('#filterUriByGlobs', () => {
        it('should filter a uri');
    });

    describe('#iterateDirectoryPath', () => {
        it('should iterate exactly 0 times');
        it('should iterate exactly 1 times');
        it('should iterate exactly 2 times');
    });

    describe('#findFileInAncestors', () => {
        it('should find a file');
        it('return null if no file is found');
    });
});
