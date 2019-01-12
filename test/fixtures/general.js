const vscode = require('../mocks/node/vscode');

module.exports = {
	mockFolder: __dirname + '/transfer/test-folder/',
	mockFolder2: __dirname + '/transfer/test-folder-2/',
	mockUriFile: vscode.Uri.file(__dirname + '/transfer/test-file.txt'),
	mockUriFile2: vscode.Uri.file(__dirname + '/transfer/test-file-2.txt'),
	mockForeignSchemeFile: new vscode.Uri('foreign-scheme', '', __dirname + '/transfer/test-file.txt'),
	mockUriFolder: vscode.Uri.file(__dirname + '/transfer/test-folder/'),
	mockUriSubFile: vscode.Uri.file(__dirname + '/transfer/test-folder/test-subfile.txt'),
	mockUriMissingFile: vscode.Uri.file(__dirname + '/transfer/nofile.txt'),
	mockUriIgnoredFile: vscode.Uri.file(__dirname + '/transfer/desktop.ini'),
	mockUriMissingDir: vscode.Uri.file(__dirname + '/transfer/missing-folder/'),
	mockUriFileWithoutWorkspace: vscode.Uri.file('/test-file.txt'),
	mockWorkspace: {
		rootPath: __dirname + '/transfer'
	},

	servers: {
		SFTP: {
			file: vscode.Uri.file('/fake/path/to/.push.settings.json'),
			contents: '[none]',
			newFile: true,
			data: {
				env: 'dev',
				service: 'SFTP',
				SFTP: {
					host: 'neilinscotland.net',
					username: 'neil',
					root: '/home/neil/push-test/standard'
				}
			},
			hash: '8b53a44c35c78bee907be597be901e60c658b547a3b59e63f52d964ae70f058e'
		}
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
