const vscode = require('vscode');

const utils = require('./utils');

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
	 * @param {string} string - Error string to show.
	 */
	appendError(string) {
		this.channel.show();

		if (arguments.length > 1) {
			string = utils.parseTemplate(string, [...arguments].slice(1));
		}

		return this.channel.appendLine(`⚠️ ${string}`);
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