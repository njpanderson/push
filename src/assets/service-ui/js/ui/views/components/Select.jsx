import React from 'react';
import PropTypes from 'prop-types';

class Select extends React.Component {
	constructor(props) {
		super(props);

		this.dom = {
			nodeSelect: React.createRef()
		};
	}

	onChange() {
		this.props.onChange && this.props.onChange(
			event,
			this.dom.nodeSelect.current.options[
				this.dom.nodeSelect.current.selectedIndex
			].value
		);
	}

	getOptions() {
		return this.props.options.map((option, index) => {
			return (<option key={index} value={option.value}>{option.label}</option>);
		});
	}

	render() {
		return (
			<select
				className={this.props.className}
				onFocus={this.props.onFocus}
				onChange={this.onChange.bind(this)}
				defaultValue={this.props.value}
				ref={this.dom.nodeSelect}>
				{this.getOptions()}
			</select>
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
