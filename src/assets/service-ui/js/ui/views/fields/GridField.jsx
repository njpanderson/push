import React from 'react';
import PropTypes from 'prop-types';
import merge from 'lodash/merge';

import { getField } from './index';
import Button from '../components/Button';
import { propTypesFormElement } from '../../../lib/proptypes';
import {
	setMappedValue,
	getFieldDefault,
	isInternalKey
} from '../../../lib/utils';
import {
	FIELDS
} from '../../../../../../lib/constants/static';

class GridField extends React.Component {
	constructor(props) {
		super(props);

		this.indices = {
			row: 0
		};

		// Set initial state
		this.state = {
			value: this.applyIds(
				// Ensure grid has at least one row
				(!props.value || !props.value.length) ?
					[this.getNewRow()] : props.value
			)
		};
	}

	/**
	 * Applies unique IDs to a set of value data
	 * @param {array} value - Value data (from props.value)
	 */
	applyIds(value = []) {
		let a;

		value = [...value];

		// Find highest ID
		for (a = 0; a < value.length; a += 1) {
			if (
				value[a].hasOwnProperty('_id') &&
				value[a]._id > this.indices.row
			) {
				// Value has an ID and it's higher than the current row index
				this.indices.row = (value[a]._id + 1);
			}
		}

		// Apply any missing IDs
		for (a = 0; a < value.length; a += 1) {
			if (!value[a].hasOwnProperty('_id')) {
				value[a]._id = this.indices.row++;
			}
		}

		return value;
	}

	/**
	 * onChange handler to accumulate data into state and send as a single object value.
	 */
	onChange(event, map, value) {
		// Send all data
		const newValue = setMappedValue(merge([], this.state.value), map, value);

		this.setState({
			value: newValue
		});

		this.props.onChange(event, newValue);
	}

	/**
	 * Add a single empty row.
	 */
	addRow() {
		const newValue = merge([], this.state.value);

		// Add item
		newValue.push(this.getNewRow());

		// Save back into state
		this.setState({
			value: this.applyIds(newValue)
		});

		this.props.onChange(event, newValue);
	}

	/**
	 * Get a new row structure.
	 * @returns {object} - A single row, to be added to the state.value array.
	 */
	getNewRow() {
		const newRow = {};

		this.props.fields.forEach((field) => {
			newRow[field.name] = getFieldDefault(field);
		});

		return newRow;
	}

	/**
	 * Deletes a single row by its index.
	 * @param {number} index - Row index (not ID) to delete.
	 */
	deleteRow(index) {
		const newValue = merge([], this.state.value);

		// Delete item
		newValue.splice(index, 1);

		// Save back into stste
		this.setState({
			value: newValue
		});

		this.props.onChange(event, newValue);
	}

	/**
	 * Get the current field headers from the value data.
	 */
	getFields() {
		const fields = [],
			fieldTypes = {};

		this.props.fields.forEach((field) => {
			fields.push(<th key={field.name} width="*">{field.label}</th>);
			fieldTypes[field.name] = field.type || FIELDS.TEXT;
		});

		// Add button/actions cell
		fields.push(
			<th key="cell-act-add-top" width="10%">
				<Button
					label="Add"
					onClick={this.addRow.bind(this)} />
			</th>
		);

		return fields;
	}

	/**
	 * Get the current row/cells from the value data.
	 */
	getValues() {
		return this.state.value.map((value, rowIndex) => {
			const cells = [],
				map = [rowIndex],
				rowKey = `row-${value._id}`;

			let cellIndex = 0,
				cellKey, key;

			for (key in value) {
				if (value.hasOwnProperty(key) && !isInternalKey(key)) {
					cellKey = `${rowKey}-cell-${cellIndex}`;

					cells.push(
						<td key={cellKey}>
							{getField(
								this.props.fields[cellIndex],
								value[key],
								[...map, key],
								{
									onFocus: this.props.onFocus,
									onChange: this.onChange.bind(this)
								}
							)}
						</td>
					);

					// Increment cell index
					cellIndex += 1;
				}
			}

			cells.push(
				<td key="cell-act-delete">
					<Button
						label="Delete"
						className="btn--destructive"
						onClick={() => { this.deleteRow(rowIndex); }} />
				</td>
			);

			return (
				<tr key={rowKey}>
					{cells}
				</tr>
			);
		});
	}

	render() {
		return (
			<div className="form-group form-group__full">
				<label>{this.props.label}</label>
				<table className="grid">
					<thead>
						<tr>
							{this.getFields()}
						</tr>
					</thead>
					<tbody>
						{this.getValues()}
					</tbody>
				</table>
			</div>
		);
	}
}

GridField.propTypes = {
	...propTypesFormElement,
	map: PropTypes.array,
	value: PropTypes.array,
	fields: PropTypes.arrayOf(PropTypes.object).isRequired
};

export default GridField;
