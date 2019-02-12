import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';

import Text from './fields/Text';

class Form extends React.Component {
	constructor(props) {
		super(props);
	}

	parseFields() {
		const fields = [];

		let option;

		for (option in this.props.env.options) {
			switch (option.type) {
			case 'text':
			default:
				fields.push(<Text
					name={option}
					value={option.value}
				/>);
			}
		}

		return fields;
	}

	render() {
		const fields = this.parseFields();

		return (
			<form>
				<p>Environment ({this.props.env.id})</p>

				<fieldset>
					{fields}
				</fieldset>
			</form>
		);
	}
}

Form.propTypes = {
	currentEnv: PropTypes.string,
	envs: PropTypes.array
};

export default Form;
