import React from 'react';
import PropTypes from 'prop-types';
import ReactSelect from 'react-select';

const customStyles = {
	container: provided => ({
		...provided,
		minWidth: 120,
	}),
	control: provided => ({
		...provided,
		outline: 0,
		borderRadius: 3,
		backgroundColor: 'var(--vscode-settings-dropdownBackground)'
	}),
	placeholder: provided => ({
		...provided,
		color: 'inherit'
	}),
	input: provided => ({
		...provided,
		color: 'inherit'
	}),
	menu: provided => ({
		...provided,
		backgroundColor: 'var(--vscode-settings-dropdownBackground)'
	}),
	option: (provided, { isDisabled, isFocused, isSelected }) => ({
		...provided,
		backgroundColor: (isDisabled ?
			'transparent' :
			isSelected || isFocused ?
				'var(--vscode-menu-selectionBackground)' : 'transparent'
		),
		color: 'inherit',
		filter: isSelected && isFocused ? 'saturate(150%)' : '',
		':active': {
			backgroundColor: 'var(--vscode-menu-selectionBackground)'
		}
	}),
	singleValue: provided => ({
		...provided,
		color: 'inherit'
	})
};

class Select extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			options: this.props.options.map(option => ({
				value: option.value,
				label: option.label
			}))
		};

		this.dom = {
			nodeSelect: React.createRef()
		};
	}

	onChange({ value }, { action }) {
		switch (action) {
		case 'select-option':
			this.props.onChange && this.props.onChange(
				value
			);
		}
	}

	getOption(value) {
		return this.state.options.find(option => option.value == value);
	}

	render() {
		return (
			<ReactSelect
				// className={this.props.className}
				onFocus={this.props.onFocus}
				onChange={this.onChange.bind(this)}
				value={this.getOption(this.props.value)}
				ref={this.dom.nodeSelect}
				styles={customStyles}
				classNamePrefix='push_select'
				options={this.state.options} />
		);
	}
}

Select.propTypes = {
	options: PropTypes.arrayOf(PropTypes.shape({
		value: PropTypes.string,
		label: PropTypes.string
	})),
	value: PropTypes.string,
	onChange: PropTypes.func,
	onFocus: PropTypes.func,
	className: PropTypes.string
};

export default Select;
