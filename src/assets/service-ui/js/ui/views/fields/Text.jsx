import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';

function Text(props) {
	return (
		<input type="text" />
	);
}

Text.propTypes = {
	name: PropTypes.string,
	value: PropTypes.string
};

export default Text;
