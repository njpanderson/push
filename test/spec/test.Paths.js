/* global suite, test */

//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
const assert = require('assert');
const expect = require('chai').expect;

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
const useMockery = require('../helpers/mockery');
const counter = require('../helpers/counter');
const fixtures = require('../fixtures/general');

// Mocks
const vscode = require('../mocks/node/vscode');

// Defines a Mocha test suite to group tests of similar kind together
describe('Paths', function() {
    let Paths, paths;

    useMockery(() => {
        useMockery
            .registerMultiple({
                'vscode': vscode
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

    describe('#pathInUri', () => {
        it('should return true for a Uri within a Uri', () => {
            assert(paths.pathInUri(
                fixtures.mockUriSubFile,
                fixtures.mockUriFolder
            ) === true);
        });

        it('should return false for a Uri not within a Uri', () => {
            assert(paths.pathInUri(
                fixtures.mockUriFile2,
                fixtures.mockUriFolder
            ) === false);
        });
    });


    describe('#getNormalPath', () => {
        it('should return a normalised (string) version of a Uri', () => {
            assert(typeof paths.getNormalPath(
                fixtures.mockUriFile
            ) === 'string');

            assert(/test-file.txt/.test(paths.getNormalPath(
                fixtures.mockUriFile
            )));
        });
    });

    describe('#getPathWithoutWorkspace', () => {
        it('should return a Uri normalised without workspace path', () => {
            assert(paths.getPathWithoutWorkspace(
                fixtures.mockUriFile,
                fixtures.mockWorkspace
            ) === '/test-file.txt')
        });
    });

    describe('#stripTrailingSlash', () => {
        it('should strip a trailing slash', () => {
            assert(paths.stripTrailingSlash(
                '/path/with/trailing/slash/'
            ) === '/path/with/trailing/slash');
        });

        it('should ignore if no trailing slash exists', () => {
            assert(paths.stripTrailingSlash(
                '/path/without/trailing/slash'
            ) === '/path/without/trailing/slash');
        });
    });

    describe('#addTrailingSlash', () => {
        it('should add exactly one trailing slash', () => {
            assert(paths.addTrailingSlash(
                '/path/without/trailing/slash'
            ) === '/path/without/trailing/slash/');
        });

        it('should ignore if a trailing slash exists', () => {
            assert(paths.addTrailingSlash(
                '/path/with/trailing/slash/'
            ) === '/path/with/trailing/slash/');
        });
    });

    describe('#isDirectory', () => {
        it('should not fault with a non-existent directory, but return false', () => {
            assert(paths.isDirectory(
                '/utter/nonsense/directory/flj3232joisdfosdjgkljhurfs/'
            ) === false);
        });
    });

    describe('#listDirectory', () => {
        it('should list a directory', () => {
            return paths.listDirectory(fixtures.mockFolder)
                .then((list) => {
                    expect(list[0].name).to.equal('.hidden-file');
                    expect(list[0].pathName).to.have.string('/transfer/test-folder/.hidden-file');
                    expect(list[0].type).to.equal('f');

                    expect(list[1].name).to.equal('another-test-subfile.txt');
                    expect(list[1].pathName).to.have.string('/transfer/test-folder/another-test-subfile.txt');
                    expect(list[1].type).to.equal('f');

                    expect(list[2].name).to.equal('test-subfile.txt');
                    expect(list[2].pathName).to.have.string('/transfer/test-folder/test-subfile.txt');
                    expect(list[2].type).to.equal('f');
                });
        });
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
