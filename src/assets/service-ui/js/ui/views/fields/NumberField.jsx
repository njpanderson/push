import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';

function NumberField(props) {
	console.log('numberField', props.label, props.value);
	return (
		<div className="form-group">
			<label>{props.label}</label>
			<input
				type="number"
				className="field__text"
				defaultValue={props.value}
				placeholder={props.placeholder} />
		</div>
	);
}

NumberField.propTypes = {
	name: PropTypes.string,
	value: PropTypes.number
};

export default NumberField;
