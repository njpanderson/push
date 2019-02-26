import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';

import { propTypesDescription } from '../../../lib/proptypes';

function FormDescription(props) {
	return (
		<p className="description">
			{props.children}
		</p>
	);
}

FormDescription.propTypes = propTypesDescription;

export default FormDescription;
