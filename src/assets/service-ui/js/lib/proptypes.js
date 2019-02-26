import PropTypes from 'prop-types';

export const propTypesFormElement = {
	name: PropTypes.string,
	value: PropTypes.string,
	label: PropTypes.string,
	placeholder: PropTypes.string,
	className: PropTypes.string,
	onFocus: PropTypes.func,
	onChange: PropTypes.func,
	description: PropTypes.oneOfType([
		PropTypes.element,
		PropTypes.string
	])
};

export const propTypesDescription = {
	children: PropTypes.oneOfType([
		PropTypes.element,
		PropTypes.string
	])
};
