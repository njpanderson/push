import React from 'react';
import PropTypes from 'prop-types';

import Select from '../components/Select';
import { propTypesFormElement } from '../../../lib/proptypes';

function SelectField(props) {
	function onChange(event) {
		props.onChange(
			event,
			event.target.options[event.target.selectedIndex].value
		);
	}

	return (
		<div className="form-group">
			<label>{props.label}</label>
			<Select
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
