import React from 'react';
import PropTypes from 'prop-types';

import { propTypesFormElement } from '../../../lib/proptypes';
import { deferredOnChange } from '../../../lib/utils';

function NumberField(props) {
	const className = 'field--text' + (props.className ? ` ${props.className}` : '');

	function onChange(event) {
		deferredOnChange(props.onChange, event.target.value);
	}

	return (
		<div className="form-group">
			<label>{props.label}</label>
			<input
				type="number"
				onFocus={props.onFocus}
				onChange={onChange}
				name={props.name}
				className={className}
				defaultValue={props.value}
				placeholder={props.placeholder} />
			{props.description}
		</div>
	);
}

NumberField.propTypes = {
	...propTypesFormElement,
	value: PropTypes.number,
	placeholder: PropTypes.number
};

export default NumberField;
