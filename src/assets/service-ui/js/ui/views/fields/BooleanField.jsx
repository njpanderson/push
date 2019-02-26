import React from 'react';
import PropTypes from 'prop-types';

import { propTypesFormElement } from '../../../lib/proptypes';

function BooleanField(props) {
	function onChange(event) {
		props.onChange(event, event.target.checked);
	}

	return (
		<div className="form-group inline">
			<label>
				<input
					type="checkbox"
					className="field--checkbox"
					onFocus={props.onFocus}
					value={props.value}
					onChange={onChange}/>
				{props.label}
			</label>
		</div>
	);
}

BooleanField.propTypes = {
	...propTypesFormElement,
	checked: PropTypes.bool,
};

export default BooleanField;
