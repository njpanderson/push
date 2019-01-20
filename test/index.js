const glob = require('glob');

describe('Push', function () {
	// debugger pause and allow unlimited timings if node env is test-live
	this.timeout(0);

	// break here so breakpoints can be made (--debug-brk breakpoint in mocha is too early!)
	// debugger;

	// require individual test specs
	glob.sync('./spec/**/test.**.js*', {
		cwd: './test'
	}).map(require);
	// // require individual test specs
	// glob.sync('./spec/**/test.*.js*', {
	// 	cwd: './test'
	// }).map(require);
});
