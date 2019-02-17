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
 * @param {boolean} fieldOnly - `true` to only return the field (with no other markup).
 */
export function getField(field, value, fieldOnly = false) {
	console.log('getField', field.name, field.type, value);
	switch (field.type) {
	case FIELDS.BOOLEAN:
		return React.createElement(fieldComponents[field.type], {
			key: field.name,
			label: (!fieldOnly ? field.label : null),
			checked: typeof value === 'boolean' ? value : field.default
		});

	case FIELDS.SELECT:
		return React.createElement(fieldComponents[field.type], {
			key: field.name,
			label: (!fieldOnly ? field.label : null),
			value: value || field.default,
			options: field.options,
		});

	case FIELDS.GRID:
		return React.createElement(fieldComponents[field.type], {
			key: field.name,
			label: (!fieldOnly ? field.label : null),
			columns: field.columns,
			value: value || field.default || []
		});

	case FIELDS.TEXT:
	case FIELDS.FILE:
	case FIELDS.NUMBER:
	case FIELDS.PASSWORD:
	default:
		return React.createElement(fieldComponents[field.type || FIELDS.TEXT], {
			key: field.name,
			label: (!fieldOnly ? field.label : null),
			name: field.name,
			placeholder: field.default,
			value: (
				typeof value !== 'undefined' ?
					(field.type === FIELDS.NUMBER ? parseFloat(value) : value) :
					field.default
			)
		});
	}
}

export default fieldComponents;
