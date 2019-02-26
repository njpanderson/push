const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const FriendlyErrorsWebpackPlugin = require('friendly-errors-webpack-plugin');

module.exports = (env, argv) => {
	const config = {
		context: path.resolve(__dirname, 'src', 'assets'),
		entry: {
			'service-ui': './service-ui/js/index.js'
		},
		output: {
			path: path.resolve(__dirname, 'assets'),
			filename: '[name]/js/index.js'
		},
		plugins: [
			new FriendlyErrorsWebpackPlugin({
				clearConsole: false,
				compilationSuccessInfo: {
					messages: ['Build Complete']
				},
			}),
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
					loader: 'babel-loader',
					options: {
						sourceMaps: 'inline'
					}
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

	if (argv.mode === 'development') {
		config.devtool = 'cheap-module-eval-source-map';
	}

	return config;
};
