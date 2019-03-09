import React from 'react';

import { propTypesFormElement } from '../../../lib/proptypes';
import { deferredOnChange } from '../../../lib/utils';

function TextField(props) {
	const className = 'field--text' + (props.className ? ` ${props.className}` : '');

	/**
	 * Handles onChange events from the input field. Fires props.onChange.
	 * @param {SyntheticEvent} event
	 */
	function onChange(event) {
		deferredOnChange(props.onChange, event.target.value);
	}

	return (
		<div className="form-group">
			<label>{props.label}</label>
			<input
				type="text"
				onFocus={props.onFocus}
				onChange={onChange}
				name={props.name}
				title={props.label}
				className={className}
				defaultValue={props.value}
				placeholder={props.placeholder} />
			{props.description}
		</div>
	);
}

TextField.propTypes = propTypesFormElement;

export default TextField;
