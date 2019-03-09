import React from 'react'; // eslint-disable-line no-unused-vars

import TextField from './TextField';
import BooleanField from './BooleanField';
import PasswordField from './PasswordField';
import NumberField from './NumberField';
import FileField from './FileField';
import GridField from './GridField';
import SelectField from './SelectField';
import {
	FIELDS
} from '../../../../../../lib/constants/static';

const fieldComponents = {
	[FIELDS.TEXT]: TextField,
	[FIELDS.BOOLEAN]: BooleanField,
	[FIELDS.PASSWORD]: PasswordField,
	[FIELDS.NUMBER]: NumberField,
	[FIELDS.FILE]: FileField,
	[FIELDS.GRID]: GridField,
	[FIELDS.SELECT]: SelectField
};

/**
 * Takes a field definition and returns a React field component.
 * @param {object} field - Field definition.
 * @param {*} value - Field value.
 * @param {array} map - Field location map.
 */
export function getField(
	field,
	value,
	map,
	componentProps = {},
	extraProps = {}
) {
	// Set default props for use by all field types
	const defaultProps = {
		key: field.name,
		label: field.label,
		// Enhance the current onChange event with specific field handling
		onChange: (value) => {
			componentProps.onChange(map, value);
		}
	};

	let key;

	switch (field.type) {
	case FIELDS.BOOLEAN:
		// Checkbox boolean option
		return React.createElement(fieldComponents[field.type], {
			...componentProps,
			...defaultProps,
			checked: typeof value === 'boolean' ? value : field.default
		});

	case FIELDS.SELECT:
		// Select/option
		return React.createElement(fieldComponents[field.type], {
			...componentProps,
			...defaultProps,
			value: value || field.default,
			options: field.options
		});

	case FIELDS.GRID:
		// A grid of options based on key/value shape
		return React.createElement(fieldComponents[field.type], {
			...componentProps,
			...defaultProps,
			fields: field.fields,
			value: value || field.default || []
		});

	case FIELDS.FILE:
		// Pseudo file selection field - set an initial key
		key = map.join(',') + value;

		return React.createElement(fieldComponents[field.type || FIELDS.TEXT], {
			...componentProps,
			...defaultProps,
			name: field.name,
			className: field.className,
			placeholder: field.default,
			// Add onFileSelection event (with map data from the field loop and value data
			// from the original event from FileField).
			onFileSelection: (value) => {
				// Update the key to the new file value, so the component remounts
				key = map.join(',') + value;

				extraProps.onFileSelection({
					map,
					defaultValue: value
				});
			},
			key,
			initialValue: (
				typeof value !== 'undefined' ?
					(field.type === FIELDS.NUMBER ? parseFloat(value) : value) :
					field.default
			)
		});

	case FIELDS.TEXT:
	case FIELDS.NUMBER:
	case FIELDS.PASSWORD:
		// Standard text/number input based fields
		return React.createElement(fieldComponents[field.type || FIELDS.TEXT], {
			...componentProps,
			...defaultProps,
			name: field.name,
			className: field.className,
			placeholder: field.default,
			value: (
				typeof value !== 'undefined' ?
					(field.type === FIELDS.NUMBER ? parseFloat(value) : value) :
					field.default
			)
		});

	default:
		throw new Error(
			`Undefined field type for field "${field.name ? field.name : 'anonymous'}"`
		);
	}
}

export default fieldComponents;
