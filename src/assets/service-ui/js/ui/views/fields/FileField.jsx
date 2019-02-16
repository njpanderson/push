import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';

function FileField(props) {
	return (
		<div className="form-group">
			<label>{props.label}</label>
			<input type="input"
				defaultValue={props.value}/>
		</div>
	);
}

FileField.propTypes = {
	name: PropTypes.string,
	value: PropTypes.string
};

export default FileField;
