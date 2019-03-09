const ServiceType = require('./ServiceType');

// Service providers
const ProviderSFTP = require('./providers/ProviderSFTP');
const ProviderFile = require('./providers/ProviderFile');
const { FIELDS } = require('../lib/constants/static');

/**
 * Provides a directory of available service providers, as well as some methods
 * for managing and listing information about the services.
 */
class ServiceDirectory {
	/**
	 * Produce a list of the services available, for use within a QuickPick dialog.
	 * @return {ServiceType[]} List of the services, including default settings payloads.
	 */
	getQuickPickList() {
		const options = [];

		let service, settingsPayload;

		for (service in ServiceDirectory.services) {
			settingsPayload = {
				'env': 'default',
				'default': {
					service
				}
			};

			settingsPayload.default.options = this.getServiceSchemaValues(service);

			options.push(new ServiceType(
				service,
				ServiceDirectory.services[service].description,
				ServiceDirectory.services[service].detail,
				settingsPayload,
				this.getServiceSchemaValues(service, 'required')
			));
		}

		return options;
	}

	/**
	 * Get cumulative keys from the settings for a service, extended from the base defaults.
	 * @param {array} serviceSchema - A reference to one of the Provider schemas on
	 * which to retrieve the default values. E.g: ProviderSFTP.optionSchema
	 */
	getServiceSchemaValues(serviceSchema, key = 'default') {
		const values = {};

		if (typeof serviceSchema === 'string') {
			serviceSchema = ServiceDirectory.services[serviceSchema].optionSchema;
		}

		// Get default values for each key from the options object
		serviceSchema.forEach((option) => {
			if (key === 'required' && option[key]) {
				// Getting required value
				values[option.name] = true;
			} else if (key !== 'required') {
				// Getting default values
				values[option.name] = option[key] || '';
			}

			if (
				option.fields &&
				(key !== 'required' || (key === 'required' && values[option[0]]))
			) {
				// Nested fields — recurse and collect further items.
				values[option.name] = this.getServiceSchemaValues(
					option.fields,
					key
				);
			}
		});

		return values;
	}

	normaliseSchema(schema) {
		return schema.map((field) => {
			if (field.fields) {
				field.fields = this.normaliseSchema(field.fields);
			}

			if (!field.type) {
				// Field has no type — default to TEXT
				field.type = FIELDS.TEXT;
			}

			return field;
		});
	}

	getSchema(service) {
		return this.normaliseSchema(
			ServiceDirectory.services[service].optionSchema || []
		);
	}
}

/**
 * A list of the service providers available.
 */
ServiceDirectory.services = {
	SFTP: ProviderSFTP,
	File: ProviderFile
};

module.exports = ServiceDirectory;
