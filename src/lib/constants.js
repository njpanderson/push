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
    ].join('\n')
};