const path = require('path');
const MomentLocalesPlugin = require('moment-locales-webpack-plugin');

const config = {
	target: 'node',
	entry: './extension.js',
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'extension.js',
		libraryTarget: 'commonjs2',
		devtoolModuleFilenameTemplate: '../[resource-path]'
	},
	devtool: 'source-map',
	externals: {
		vscode: 'commonjs vscode' // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
	},
	resolve: {
		extensions: ['.js']
	},
	plugins: [
		new MomentLocalesPlugin({
			localesToKeep: ['ja', 'it'],
		})
	]
};

module.exports = config;
