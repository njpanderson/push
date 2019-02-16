import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';

import { getField } from './fields';

class Form extends React.Component {
	constructor(props) {
		super(props);
	}

	getFieldValue(field) {
		return (
			this.props.env.options.hasOwnProperty(field) ?
				this.props.env.options[field] :
				this.getSchemaDefault(field)
		);
	}

	getSchemaDefault(field, defaultValue = '') {
		const option = this.props.schema.find(option => option.name === field);

		if (option && option.default) {
			return option.default;
		} else {
			return defaultValue;
		}
	}

	parseFieldSets(schema, counter = 1) {
		const fields = schema.map((field) => {
				if (field.fields) {
					return this.parseFieldSets(field.fields, counter + 1);
				} else {
					return getField(field, this.getFieldValue(field.name));
				}
			}),
			key = `fieldset-${counter}`;

		return (
			<fieldset key={key}>
				{fields}
			</fieldset>
		);
	}

	render() {
		const fieldSets = this.parseFieldSets(this.props.schema);

		return (
			<form>
				<p>Environment ({this.props.env.id})</p>

				{fieldSets}
			</form>
		);
	}
}

Form.propTypes = {
	env: PropTypes.object,
	schema: PropTypes.arrayOf(PropTypes.object)
};

export default Form;
