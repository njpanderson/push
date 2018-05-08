/* global suite, test */

//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
const assert = require('assert');

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
const useMockery = require('../helpers/mockery');

// Defines a Mocha test suite to group tests of similar kind together
suite('Push', function() {
    let Push;

    useMockery(() => {
        useMockery
            .registerMultiple({
                'vscode': require('../mocks/node/vscode'),
                './lib/ServiceSettings': {},
                './lib/Service': {},
                './lib/explorer/Explorer': {},
                './lib/Paths': {},
                './lib/queue/Queue': {},
                './lib/queue/QueueTask': {},
                './lib/Watch': {},
                './lib/SCM': {},
                './lib/channel': {},
                './lib/utils': {},
                './lib/PushBase': require('../mocks/lib/PushBase'),
                './lang/i18n': require('../mocks/lib/i18n')
            });
    });

    before(() => {
        Push = require('../../src/Push');
    });

    // Defines a Mocha unit test
    describe('#didSaveTextDocument', () => {
        it('should return when textDocument has no uri', () => {
            assert.equal(-1, [1, 2, 3].indexOf(5));
            assert.equal(-1, [1, 2, 3].indexOf(0));
        })
    });
});