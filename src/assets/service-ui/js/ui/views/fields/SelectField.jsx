import React from 'react';
import PropTypes from 'prop-types';

import Select from '../components/Select';
import { propTypesFormElement } from '../../../lib/proptypes';
import { deferredOnChange } from '../../../lib/utils';

function SelectField(props) {
	function onChange(value) {
		deferredOnChange(
			props.onChange,
			value
		);
	}

	return (
		<div className="form-group">
			<label>{props.label}</label>
			<Select
				isSearchable
				isClearable
				name={props.name}
				options={props.options}
				value={props.value}
				onFocus={props.onFocus}
				onChange={onChange} />
		</div>
	);
}

SelectField.propTypes = {
	...propTypesFormElement,
	options: PropTypes.array
};

export default SelectField;
