import React from 'react';

import { propTypesFormElement } from '../../../lib/proptypes';

function PasswordField(props) {
	function onChange(event) {
		props.onChange(event, event.target.value);
	}

	return (
		<div className="form-group">
			<label>{props.label}</label>
			<input
				type="password"
				onFocus={props.onFocus}
				onChange={onChange}
				className="field--text"
				defaultValue={props.value}
				placeholder={props.placeholder} />
		</div>
	);
}

PasswordField.propTypes = propTypesFormElement;

export default PasswordField;
