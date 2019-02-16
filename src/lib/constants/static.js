module.exports = {
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
	PUSH_MESSAGE_PREFIX: 'Push: ',

	COMMS: {
		VIEW_INIT: 'VIEW_INIT',
		SET_INITIAL_STATE: 'SET_INITIAL_STATE',
		GET_SERVICE_OPT_SCHEMA: 'GET_SERVICE_OPT_SCHEMA',
		SET_SERVICE_OPT_SCHEMA: 'SET_SERVICE_OPT_SCHEMA'
	},

	FIELDS: {
		TEXT: 'Text',
		NUMBER: 'Number',
		PASSWORD: 'Password',
		FILE: 'File',
		GRID: 'Grid',
		BOOLEAN: 'Boolean',
		SELECT: 'Select'
	}
};
