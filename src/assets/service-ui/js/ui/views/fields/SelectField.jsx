import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';

function SelectField(props) {
	const options = props.options.map((option) => {
		return (
			<option value={option.value} key={option.value}>
				{option.label}
			</option>
		);
	});

	return (
		<div className="form-group">
			<label>{props.label}</label>
			<select>
				{options}
			</select>
		</div>
	);
}

SelectField.propTypes = {
	name: PropTypes.string,
	value: PropTypes.string
};

export default SelectField;
