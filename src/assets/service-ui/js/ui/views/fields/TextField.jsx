import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';

function TextField(props) {
	console.log('TextField', props.name, props.value);
	const className = 'field__text' + (props.className ? ` ${props.className}` : '');

	return (
		<div className="form-group">
			<label>{props.label}</label>
			<input
				type="text"
				className={className}
				name={props.name}
				defaultValue={props.value}
				placeholder={props.placeholder} />
		</div>
	);
}

TextField.propTypes = {
	name: PropTypes.string,
	value: PropTypes.string,
	className: PropTypes.string
};

export default TextField;
