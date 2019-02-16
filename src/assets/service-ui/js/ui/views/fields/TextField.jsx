import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';

function TextField(props) {
	return (
		<div className="form-group">
			<label>{props.label}</label>
			<input
				type="text"
				defaultValue={props.value}
				placeholder={props.placeholder} />
		</div>
	);
}

TextField.propTypes = {
	name: PropTypes.string,
	value: PropTypes.string
};

export default TextField;
