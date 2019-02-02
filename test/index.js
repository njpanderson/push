const glob = require('glob');

describe('Push', function () {
	// debugger pause and allow unlimited timings if node env is test-live
	this.timeout(0);

	// require individual test specs
	glob.sync('./spec/**/test.**.js*', {
		cwd: './test'
	}).map(require);
});
