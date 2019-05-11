/* global suite, test */
const expect = require('chai').expect;
const path = require('path');

const useMockery = require('../../helpers/mockery');
const counter = require('../../helpers/counter');
const fixtures = require('../../fixtures/general');

// Mocks
const vscode = require('../../mocks/node/vscode');

describe('Paths', function() {
	let Paths, paths;

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
		Paths = require('../../../src/Paths');
	});

	beforeEach(() => {
		counter.reset();
		paths = new Paths();
	});

	describe('#fileExists', () => {
		it('should return whether a Uri exists', () => {
			expect(paths.fileExists(fixtures.mockUriFile)).to.be.true;
		});
		it('should return false if a non-file Uri is passed', () => {
			expect(paths.fileExists(fixtures.mockForeignSchemeFile)).to.be.false;
		});
	});

	describe('#pathInUri', () => {
		it('should return true for a Uri within a Uri', () => {
			expect(paths.pathInUri(
				fixtures.mockUriSubFile,
				fixtures.mockUriFolder
			)).to.be.true;
		});

		it('should return false for a Uri not within a Uri', () => {
			expect(paths.pathInUri(
				fixtures.mockUriFile2,
				fixtures.mockUriFolder
			)).to.be.false;
		});
	});


	describe('#getNormalPath', () => {
		it('should return a normalised (string) version of a Uri', () => {
			expect(typeof paths.getNormalPath(
				fixtures.mockUriFile
			)).to.equal('string');

			expect(paths.getNormalPath(
				fixtures.mockUriFile
			)).to.have.string('test-file.txt');
		});
	});

	describe('#getPathWithoutWorkspace', () => {
		it(`should return a path without the workspace path (${fixtures.mockPathWithoutWorkspace})`, () => {
			expect(paths.getPathWithoutWorkspace(
				fixtures.mockUriFile,
				fixtures.mockWorkspace
			)).to.equal(fixtures.mockPathWithoutWorkspace);
		});

		it(`should return a path without the workspace path (${fixtures.mockSubPathWithoutWorkspace})`, () => {
			expect(paths.getPathWithoutWorkspace(
				fixtures.mockUriSubFile,
				fixtures.mockWorkspace
			)).to.equal(fixtures.mockSubPathWithoutWorkspace);
		});

		it(`should return the original path outside of the workspace path (${fixtures.mockPathWithoutWorkspace})`, () => {
			expect(paths.getPathWithoutWorkspace(
				fixtures.mockUriWithoutWorkspace,
				fixtures.mockWorkspace
			)).to.equal(fixtures.mockPathWithoutWorkspace);
		});
	});

	describe('#stripTrailingSlash', () => {
		it('should strip a trailing slash', () => {
			expect(paths.stripTrailingSlash(fixtures.mockFolderWithTrailingSlash)).to.equal(
				fixtures.mockFolder
			);
		});

		it('should ignore if no trailing slash exists', () => {
			expect(paths.stripTrailingSlash(fixtures.mockFolder)).to.equal(
				fixtures.mockFolder
			);
		});

		it('should strip a custom trailing slash (/)', () => {
			expect(paths.stripTrailingSlash('/test/forward/slash/', '/')).to.equal(
				'/test/forward/slash'
			);
		});

		it('should ignore if no custom trailing slash exists (/)', () => {
			expect(paths.stripTrailingSlash('/test/forward/slash', '/')).to.equal(
				'/test/forward/slash'
			);
		});

		it('should strip a custom trailing slash (\\)', () => {
			expect(paths.stripTrailingSlash('\\test\\forward\\slash\\', '\\')).to.equal(
				'\\test\\forward\\slash'
			);
		});

		it('should ignore if no custom trailing slash exists (\\)', () => {
			expect(paths.stripTrailingSlash('\\test\\forward\\slash', '\\')).to.equal(
				'\\test\\forward\\slash'
			);
		});
	});

	describe('#addTrailingSlash', () => {
		it('should add exactly one trailing slash', () => {
			expect(paths.addTrailingSlash(
				fixtures.mockFolder
			)).to.equal(
				fixtures.mockFolderWithTrailingSlash
			);
		});

		it('should ignore if a trailing slash exists', () => {
			expect(paths.addTrailingSlash(
				fixtures.mockFolderWithTrailingSlash
			)).to.equal(fixtures.mockFolderWithTrailingSlash);
		});

		it('should add a custom trailing slash (/)', () => {
			expect(paths.addTrailingSlash('/test/forward/slash', '/')).to.equal(
				'/test/forward/slash/'
			);
		});

		it('should ignore if a custom trailing slash exists (/)', () => {
			expect(paths.addTrailingSlash('/test/forward/slash/', '/')).to.equal(
				'/test/forward/slash/'
			);
		});

		it('should add a custom trailing slash (\\)', () => {
			expect(paths.addTrailingSlash('\\test\\forward\\slash', '\\')).to.equal(
				'\\test\\forward\\slash\\'
			);
		});

		it('should ignore if a custom trailing slash exists (\\)', () => {
			expect(paths.addTrailingSlash('\\test\\forward\\slash\\', '\\')).to.equal(
				'\\test\\forward\\slash\\'
			);
		});
	});

	describe('#isDirectory', () => {
		it('should not fault with a non-existent directory, but return false', () => {
			expect(paths.isDirectory(
				fixtures.mockUriMissingDir
			)).to.be.false;
		});
	});

	describe('#listDirectory', () => {
		it('should list a directory', () => {
			return paths.listDirectory(fixtures.mockFolder)
				.then((list) => {
					let test = [];

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

	describe('#findFileInAncestors', () => {
		it('should find a file');
		it('return null if no file is found');
	});
});
