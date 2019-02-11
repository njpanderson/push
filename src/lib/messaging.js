module.exports = {
	postMessage(origin, type, data) {
		origin.postMessage({
			type,
			data
		});
	},

	getMessageType(message) {
		return message.type;
	},

	getMessageData(message) {
		return message.data;
	}
};
