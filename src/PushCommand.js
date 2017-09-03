const Push = require('./Push');

class PushCommand {
	constructor() {
		this.upload = this.upload.bind(this);
		this.download = this.download.bind(this);

		this.push = new Push();
	}

	upload(src) {
		this.push.command('upload', src);
	}

	download(src) {
		this.push.command('download', src);
	}
}

module.exports = PushCommand;