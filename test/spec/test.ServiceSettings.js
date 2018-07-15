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
const counter = require('../helpers/counter');
const fixtures = require('../fixtures/general');

// Defines a Mocha test suite to group tests of similar kind together
describe('ServiceSettings', function() {
    let ServiceSettings;

    // useMockery(() => {
    //     useMockery
    //         .registerMultiple({
    //             'vscode': require('../mocks/node/vscode'),
    //             './lib/ServiceSettings': require('../mocks/lib/ServiceSettings').sftp,
    //             './lib/Service': require('../mocks/lib/Service'),
    //             './lib/explorer/Explorer': require('../mocks/lib/Explorer'),
    //             // './lib/Paths': require('../mocks/lib/Paths'),
    //             './lib/queue/Queue': {},
    //             './lib/queue/QueueTask': {},
    //             './lib/Watch': require('../mocks/lib/Watch'),
    //             './lib/SCM': require('../mocks/lib/SCM'),
    //             './lib/channel': {},
    //             './lib/utils': {},
    //             './lib/PushBase': require('../mocks/lib/PushBase'),
    //             './lang/i18n': require('../mocks/lib/i18n')
    //         });
    // });

    before(() => {
        ServiceSettings = require('../../src/lib/ServiceSettings');
    });

    beforeEach(() => {
        counter.reset();
    });

    // Defines a Mocha unit test
    describe('#clear', () => {
        it('should clear the cache');
    });

    describe('#getServerJSON', () => {
        it('should get a directory given a file');
        it('should use a cached file if it exists');
        it('should read and set a new file into cache');
    });
});