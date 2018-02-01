module.exports = {
    CONFIG_FORMATS: {
        'SSFTP': /sftp-config\.json/i
    },

    DEFAULT_SERVICE_CONFIG: [
        '{',
            '\t"service": "[ServiceName]",',
            '\t"[ServiceName]": {',
                '\t\t\/\/ Add service configuration here...',
            '\t}',
        '}'
    ].join('\n'),

    STATUS_PRIORITIES: {
        UPLOAD_QUEUE: 1,
        WATCH: 2,
        UPLOAD_STATUS: 3
    }
};