import React from 'react';
import PropTypes from 'prop-types';

function Button(props) {
	return (
		<button
			onClick={props.onClick}
			className={props.className}>
			{props.label}
		</button>
	);
}

Button.propTypes = {
	label: PropTypes.string,
	className: PropTypes.string,
	onClick: PropTypes.func,
};

export default Button;
