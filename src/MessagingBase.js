/**
 * @typedef {function} onReceiveHandler
 * @param {string} messageType - The type of message.
 * @param {*} messageData - The message data.
 */

class MessagingBase {
	constructor() {
		this.subscribers = {
			onReceive: null
		};
	}

	/**
	 * Call with a function argument to subscribe to incoming messages.
	 * @param {onReceiveHandler} subscriber
	 */
	onReceive() {
		if (typeof arguments[0] === 'function') {
			this.subscribers.onReceive = arguments[0];
		} else if (
			typeof MessageEvent !== 'undefined' &&
			arguments[0] instanceof MessageEvent
		) {
			// Handle MessageEvent event
			this.fire(
				'onReceive',
				this.getMessageType(arguments[0].data),
				this.getMessageData(arguments[0].data)
			);
		} else if (arguments[0] instanceof Object) {
			// Handle regular object
			this.fire(
				'onReceive',
				this.getMessageType(arguments[0]),
				this.getMessageData(arguments[0])
			);
		}
	}

	fire(fn) {
		if (this.subscribers[fn]) {
			this.subscribers[fn].apply(this, [...arguments].slice(1));
		}
	}

	getMessageType(message) {
		return message.type;
	}

	getMessageData(message) {
		return message.data || null;
	}

	formatMessage(type, data) {
		return {
			type,
			data
		};
	}
}

module.exports = MessagingBase;
