const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
	context: path.resolve(__dirname, 'src', 'assets'),
	entry: {
		'service-ui': './service-ui/js/index.js'
	},
	output: {
		path: path.resolve(__dirname, 'assets'),
		filename: '[name]/js/index.js'
	},
	plugins: [
		new CopyWebpackPlugin([{
			from: '**/*.html',
			to: './'
		}])
	],
	resolve: {
		extensions: ['.js', '.jsx']
	},
	module: {
		rules: [{
			test: /\.m?jsx?$/,
			exclude: /(node_modules|bower_components)/,
			use: {
				loader: 'babel-loader'
			}
		},{
			test: /\.scss$/,
			use: [
				'style-loader',
				'css-loader',
				'sass-loader'
			]
		}]
	}
};
