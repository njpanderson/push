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

	columns.push(
		<th key="cell-act-add-top">[add]</th>
	);

	console.log('GridField', props);

	const fields = props.value.map((value, rowIndex) => {
		const cells = [],
			rowKey = `row-${rowIndex}`;

		let cellIndex = 0,
			cellKey, key;

		for (key in value) {
			cellKey = `${rowKey}-cell-${cellIndex}`;

			cells.push(
				<td key={cellKey}>
					{getField(props.columns[cellIndex], value[key], true)}
				</td>
			);

			cellIndex += 1;
		}

		cells.push(
			<td key="cell-act-delete">[Delete]</td>
		);

		return (
			<tr key={rowKey}>
				{cells}
			</tr>
		);
	});

	return (
		<div className="form-group form-group__full">
			<label>{props.label}</label>
			<table className="grid">
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
