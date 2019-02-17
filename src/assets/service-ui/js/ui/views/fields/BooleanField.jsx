import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';

function BooleanField(props) {
	return (
		<div className="form-group inline">
			<input type="checkbox" value={props.value}/>
			<label>{props.label}</label>
		</div>
	);
}

BooleanField.propTypes = {
	name: PropTypes.string,
	checked: PropTypes.bool,
	value: PropTypes.string
};

export default BooleanField;
