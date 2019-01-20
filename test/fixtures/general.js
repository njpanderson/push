const path = require('path');

const vscode = require('../mocks/node/vscode');
const fixtureServiceLoader = require('../helpers/fixtureServiceLoader');

module.exports = {
	mockFolder: path.join(__dirname, 'transfer', 'test-folder'),
	mockFolderWithTrailingSlash: path.join(__dirname, 'transfer', 'test-folder', path.sep),
	mockFolder2: path.join(__dirname, 'transfer', 'test-folder-2'),
	mockUriFile: vscode.Uri.file(path.join(__dirname, 'transfer', 'test-file.txt')),
	mockUriFile2: vscode.Uri.file(path.join(__dirname, 'transfer', 'test-file-2.txt')),
	mockForeignSchemeFile: new vscode.Uri('foreign-scheme', '', path.join(__dirname, 'transfer', 'test-file.txt')),
	mockUriFolder: vscode.Uri.file(path.join(__dirname, 'transfer', 'test-folder')),
	mockUriSubFile: vscode.Uri.file(path.join(__dirname, 'transfer', 'test-folder', 'test-subfile.txt')),
	mockUriMissingFile: vscode.Uri.file(path.join(__dirname, 'transfer', 'nofile.txt')),
	mockUriIgnoredFile: vscode.Uri.file(path.join(__dirname, 'transfer', 'desktop.ini')),
	mockUriMissingDir: vscode.Uri.file(path.join(__dirname, 'transfer', 'missing-folder')),
	fileRemoteTarget: path.join(__dirname, 'file-remote-target', 'test-file.txt'),
	mockPathWithoutWorkspace: path.join('test-file.txt'),
	mockUriWithoutWorkspace: vscode.Uri.file(path.join('test-file.txt')),
	mockSubPathWithoutWorkspace: path.join('test-folder/test-subfile.txt'),

	mockWorkspace: vscode.workspace,

	services: {
		File: fixtureServiceLoader('File'),
		SFTP: fixtureServiceLoader('SFTP')
	},

	queueDefinitions: {
		cancellable: {
			id: 'testQueue',
			cancellable: true
		},

		nonCancellable: {
			id: 'testNonCancellableQueue'
		}
	},

	pathCache: {
		list1: [
			{ name: 'filename1.txt' },
			{ name: 'filename2.txt' },
			{ name: 'filename3.txt' },
			{ name: 'filename4.txt' },
			{ name: 'filename5.txt' }
		],
		list2: [
			{ name: 'filename1.txt' },
			{ name: 'filename1-2.txt' },
			{ name: 'filename-1-20-2009.ogg' },
			{ name: 'filename-1-20-2009-2.ogg' },
			{ name: 'filename4.jpg' },
			{ name: 'filename4-2.jpg' },
			{ name: 'filename4-3.jpg' },
			{ name: 'filename5.mvk' }
		]
	}
};
