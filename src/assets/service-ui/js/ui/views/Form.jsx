import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';

function Form(props) {
	return (
		<form>
			<p>Form ({props.currentEnv})</p>
		</form>
	);
}

Form.propTypes = {
	currentEnv: PropTypes.string,
	envs: PropTypes.array
};

export default Form;
