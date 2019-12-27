const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const config = require('./webpack.config.js');

config.plugins.push(
	new BundleAnalyzerPlugin()
);

module.exports = config;
