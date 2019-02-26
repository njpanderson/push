import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';

import { getField } from './fields';
// import FormToolbar from './components/FormToolbar';
import FormDescription from './components/FormDescription';
import { FIELDS } from '../../../../../lib/constants/static';
import { getFieldDefault } from '../../lib/utils';
import FormToolbar from '../containers/FormToolbar';

class Form extends React.Component {
	constructor(props) {
		super(props);
	}

	/**
	 * Find the value for a field within the supplied schema.
	 * @param {array} schema - The schema set for the fields.
	 * @param {values} object - Key/value pair of field values to pick from.
	 * @param {string} field - Field name.
	 */
	getFieldValue(field, values) {
		return (
			values.hasOwnProperty(field.name) ?
				values[field.name] :
				getFieldDefault(field)
		);
	}

	/**
	 * Retrieves a list of services, compatible with the Select component.
	 */
	getServiceOptions() {
		return Object.keys(this.props.schemas).map((type) => {
			return ({
				value: type,
				label: type
			});
		});
	}

	/**
	 * @description
	 * Parses the available schema and values, producing a set of fields within
	 * an array of fieldset eleements.
	 * @param {array} schema - Schema, from ServiceDirectory#getSchema.
	 * @param {object} values - The environment values, as set by the user.
	 * @param {string} [heading] - Optional fieldset heading.
	 * @param {number} [counter] - Incrementing counter, used internally for keys.
	 * @param {array} [map] - Location map to find the field within the data during events.
	 */
	parseFieldSets(schema, values, heading = '', counter = 1, map = []) {
		const key = `fieldset-${counter}`;

		const fields = schema.map((field) => {
			const description = field.description ?
				<FormDescription>{field.description}</FormDescription> :
				'';

			// For each field in the schema, parse and return a field
			if (field.type === FIELDS.FIELDSET) {
				// Parse a nested fieldset schema
				return this.parseFieldSets(
					field.fields,
					values[field.name] || {},
					field.label,
					counter + 1,
					[...map, field.name]
				);
			} else {
				// Parse a single field type
				return getField(
					field,
					this.getFieldValue(field, values),
					[...map, 'options', field.name],
					{
						description,
						onFocus: (event) => {
							this.props.onFocus &&
								this.props.onFocus(event, key);
						},
						onChange: (event, map, value) => {
							console.log('Form field change', field.name, map, value);
						}
					},
					{
						onFileSelection: this.props.onFileSelection
					}
				);
			}
		});

		heading = heading && (
			<h2>{heading}</h2>
		);

		// Return the completed fieldset
		return (
			<div className="fieldset" key={key}>
				{heading}
				{fields}
			</div>
		);
	}

	onSubmit(event) {
		event.preventDefault();
	}

	render() {
		// Get fieldsets
		const fieldSets = this.parseFieldSets(
			this.props.schemas[this.props.env.service],
			this.props.env.options,
			'',
			1,
			[this.props.env.id]
		);

		return (
			<form onSubmit={this.onSubmit.bind(this)}>
				<FormToolbar
					env={this.props.env}
					serviceOptions={this.getServiceOptions()} />
				{fieldSets}
			</form>
		);
	}
}

Form.propTypes = {
	env: PropTypes.object,
	schemas: PropTypes.object,
	onChange: PropTypes.func,
	onFocus: PropTypes.func,
	onFileSelection: PropTypes.func
};

export default Form;
