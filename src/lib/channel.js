const vscode = require('vscode');

const utils = require('./utils');
const configService = require('./config');
const i18n = require('../lang/i18n');

class Channel {
	constructor(name) {
		this.channel = vscode.window.createOutputChannel(name);
	}

	/**
	 * Appends a basic line to the channel output.
	 * @see https://code.visualstudio.com/docs/extensionAPI/vscode-api#OutputChannel
	 */
	appendLine() {
		return this.channel.appendLine.apply(this.channel, arguments);
	}

	/**
	 * Produces a line formatted as an error (and also shows the output window).
	 * @param {string} error - Error or string to show.
	 */
	appendError(error) {
		let message, config;

		if (error instanceof Error) {
			config = configService.get();
			message = error.message;

			if (config.debugMode && error.fileName && error.lineNumber) {
				message += ` (${error.fileName}:${error.lineNumber})`;
			}
		} else {
			message = error;
		}

		this.channel.show();

		if (arguments.length > 1) {
			message = utils.parseTemplate(message, [...arguments].slice(1));
		}

		return this.channel.appendLine(`⚠️ ${message}`);
	}

	/**
	 * @description
	 * Produces a line formatted as an error (and also shows the output window).
	 * Uses localisation.
	 * @param {string} error - Localised string key to show.
	 * @param {...mixed} $2 - Replacement arguments as needed.
	 */
	appendLocalisedError(error) {
		let message, config,
			placeHolders = [...arguments].slice(1);

		if (error instanceof Error) {
			config = config.get();
			message = i18n.t.apply(i18n, [error.message].concat(placeHolders));

			if (config.debugMode && error.fileName && error.lineNumber) {
				message += ` (${error.fileName}:${error.lineNumber})`;
			}
		} else {
			message = i18n.t.apply(i18n, [error].concat(placeHolders));
		}

		this.channel.show();

		return this.channel.appendLine(`⚠️ ${message}`);
	}

	/**
	 * Produces a line formatted as an informative note.
	 * @param {string} string - Information string to show.
	 */
	appendInfo(string) {
		if (arguments.length > 1) {
			string = utils.parseTemplate(string, [...arguments].slice(1));
		}

		return this.channel.appendLine(`ℹ️ ${string}`);
	}

	/**
	 * Produces a line formatted as an informative note. Uses localisation.
	 * @param {string} string - Localised string key to show.
	 * @param {...mixed} $2 - Replacement arguments as needed.
	 */
	appendLocalisedInfo(string) {
		return this.channel.appendLine(
			`ℹ️ ${i18n.t.apply(i18n, [string].concat([...arguments].slice(1)))}`
		);
	}

	show() {
		return this.channel.show.apply(this.channel, arguments);
	}

	hide() {
		return this.channel.hide.apply(this.channel, arguments);
	}

	clear() {
		return this.channel.clear.apply(this.channel, arguments);
	}
}

module.exports = new Channel('Push');