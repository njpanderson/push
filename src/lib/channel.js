const vscode = require('vscode');

class Channel {
	constructor(name) {
		this.channel = vscode.window.createOutputChannel(name);
	}

	appendLine() {
		return this.channel.appendLine.apply(this.channel, arguments);
	}

	appendError(string) {
		return this.channel.appendLine(`⚠️ ${string}`);
	}

	appendInfo(string) {
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