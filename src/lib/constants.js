const i18n = require('../lang/i18n');

module.exports = {
    CONFIG_FORMATS: {
        'SSFTP': /sftp-config\.json/i
    },

    DEFAULT_SERVICE_CONFIG: [
        '{',
            '\t"service": "[ServiceName]",',
            '\t"[ServiceName]": {',
                '\t\t\/\/ ' + i18n.t('comm_add_service_config'),
            '\t}',
        '}'
    ].join('\n'),

    STATUS_PRIORITIES: {
        UPLOAD_QUEUE: 1,
        WATCH: 2,
        UPLOAD_STATUS: 3
    },


    TRANSFER_TYPES: {
        PUT: 0,
        GET: 1
    },

    QUEUE_LOG_TYPES: {
        success: 0,
        fail: 1,
        skip: 2
    },

    TMP_FILE_PREFIX: 'vscode-push-tmp-'
};
