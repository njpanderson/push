import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';

import { getField } from './index';
import {
	FIELDS
} from '../../../../../../lib/constants/static';

function GridField(props) {
	const columns = [],
		columnFieldTypes = {};

	props.columns.forEach((column) => {
		columns.push(<th key={column.name}>{column.label}</th>);
		columnFieldTypes[column.name] = column.type || FIELDS.TEXT;
	});

	const fields = props.value.map((value, rowIndex) => {
		const cells = [],
			rowKey = `row-${rowIndex}`;

		let cellIndex = 0,
			cellKey, key;

		for (key in value) {
			cellKey = `${rowKey}-cell-${cellIndex++}`;

			cells.push(
				<td key={cellKey}>
					// TODO: get the right column/field here!
					{getField(props.columns[cellIndex], value[key], true)}
				</td>
			);
		}

		return (
			<tr key={rowKey}>
				{cells}
			</tr>
		);
	});

	return (
		<div className="form-group">
			<label>{props.label}</label>
			<table>
				<thead>
					<tr>
						{columns}
					</tr>
				</thead>
				<tbody>
					{fields}
				</tbody>
			</table>
		</div>
	);
}

GridField.propTypes = {
	name: PropTypes.string,
	value: PropTypes.array,
	columns: PropTypes.arrayOf(PropTypes.object).isRequired
};

export default GridField;
