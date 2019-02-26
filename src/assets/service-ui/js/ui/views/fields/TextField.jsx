import React from 'react';

import { propTypesFormElement } from '../../../lib/proptypes';

function TextField(props) {
	const className = 'field--text' + (props.className ? ` ${props.className}` : '');

	function onChange(event) {
		props.onChange && props.onChange(event, event.target.value);
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
