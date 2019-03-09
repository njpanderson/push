import React from 'react';
import PropTypes from 'prop-types';

import Button from '../components/Button';
import { propTypesFormElement } from '../../../lib/proptypes';
import { deferredOnChange } from '../../../lib/utils';

class FileField extends React.Component {
	constructor(props) {
		super(props);

		this.dom = {
			nodeInput: React.createRef()
		};

		/**
		 * Populate state with the initial value
		 */
		this.state = {
			value: this.props.initialValue
		};
	}

	/**
	 * @description
	 * Triggered by an onChange event on the text field, this function is designed
	 * to only handle manual updates to the input field via typing. When an update
	 * is made with the "select" button, an onchange event is unecessary as the
	 * update occurs within the Root component via a SET_FILE_SELECTION communication
	 * from the host extension. The value of this field is then updated accordingly
	 * as a byproduct of a state change via dispatch.
	 * @param {event} event - onChange event.
	 */
	onChange(event) {
		this.setState({
			value: this.dom.nodeInput.current.value
		});

		deferredOnChange(this.props.onChange, this.dom.nodeInput.current.value);
	}

	/**
	 * Triggers the file selection prop.
	 * @param {event} event
	 */
	onFileSelection(event) {
		event.preventDefault();
		this.props.onFileSelection(this.dom.nodeInput.current.value);
	}

	render() {
		const className = 'field--text' + (this.props.className ? ` ${this.props.className}` : '');

		return (
			<div className="form-group">
				<label>{this.props.label}</label>

				<div className="input-group">
					<input type="input"
						className={className}
						value={this.state.value}
						onFocus={this.props.onFocus}
						onChange={this.onChange.bind(this)}
						ref={this.dom.nodeInput} />
					<Button
						label="Select"
						onClick={this.onFileSelection.bind(this)} />
				</div>
			</div>
		);
	}
}

FileField.propTypes = {
	...propTypesFormElement,
	initialValue: PropTypes.string,
	onFileSelection: PropTypes.func
};

export default FileField;
