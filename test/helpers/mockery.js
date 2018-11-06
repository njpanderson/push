const mockery = require('mockery');

/**
 * A wrapper shamelessly inspired by the Wordpress Calypso project technique.
 * Thanks, Automattic!
 */
function useMockery(beforeActions) {
	before(() => {
		mockery.enable({
			warnOnReplace: false,
			warnOnUnregistered: false
		});

		if (typeof beforeActions === 'function') {
			return beforeActions(mockery);
		}
	});

	after(() => {
		mockery.deregisterAll();
		mockery.disable();
	});
}

useMockery.registerMultiple = function (mocks) {
	for (var mock in mocks) {
		mockery.registerMock(mock, mocks[mock]);
	}
	return useMockery;
};

module.exports = useMockery;
