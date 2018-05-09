const vscode = require('../mocks/node/vscode');

module.exports = {
	mockUriFile: vscode.Uri.file('/test.txt'),
	mockUriFolder: vscode.Uri.file('/test/'),

	servers: {
		SFTP: {
			host: 'www.testhost.com',
			username: 'testuser',
			password: 'password',
			root: '/'
		}
	}
};