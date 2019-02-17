import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';

function PasswordField(props) {
	return (
		<div className="form-group">
			<label>{props.label}</label>
			<input
				type="password"
				className="field__text"
				defaultValue={props.value}
				placeholder={props.placeholder} />
		</div>
	);
}

PasswordField.propTypes = {
	name: PropTypes.string,
	value: PropTypes.string
};

export default PasswordField;
