class ServiceType {
	constructor(label, description, detail, settingsPayload, requiredOptions) {
		this.label = label;
		this.description = description;
		this.detail = detail;
		this.settingsPayload = settingsPayload;
		this.requiredOptions = requiredOptions;
	}
}

module.exports = ServiceType;
