import React from 'react';

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
