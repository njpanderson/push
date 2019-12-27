class ExtendedStream {
	constructor({ read, write }, fileData, file) {
		this.read = read;
		this.write = write;

		this.fileData = fileData;
		this.file = file;
	}
}

module.exports = ExtendedStream;