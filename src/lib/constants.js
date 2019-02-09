const fs = require('fs');
const path = require('path');

module.exports = {
	DEBUG: fs.existsSync(path.join(path.dirname(path.dirname(__dirname)), '.debug')),

	PATH_ASSETS: path.join(path.dirname(__dirname), 'assets'),

	CONFIG_FORMATS: {
		'SSFTP': /sftp-config\.json/i
	},

	DEFAULT_SERVICE_CONFIG: [
		'{',
		'\t"env": "default",',
		'\t"default": {',
		'\t\t"service": "[ServiceName]",',
		'\t\t"options": {',
		'\t\t\t// {{PLACACEHOLDER_EMPTY_CONFIG}}',
		'\t\t}',
		'\t}',
		'}'
	].join('\n'),

	STATUS_PRIORITIES: {
		ENV: 1,
		UPLOAD_QUEUE: 2,
		WATCH: 3,
		UPLOAD_STATUS: 4
	},

	ENV_DEFAULT_STATUS_COLOR: 'statusBar.foreground',

	TRANSFER_TYPES: {
		PUT: 0,
		GET: 1
	},

	/**
	 * File/folder cache source locations (Used manily by PathCache)
	 */
	CACHE_SOURCES: {
		remote: 'remote',
		local: 'local'
	},

	QUEUE_LOG_TYPES: {
		success: 0,
		fail: 1,
		skip: 2
	},

	TMP_FILE_PREFIX: 'vscode-push-tmp-',
	PUSH_MESSAGE_PREFIX: 'Push: '
};
