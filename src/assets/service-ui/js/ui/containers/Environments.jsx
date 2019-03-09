import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import Form from '../views/Form';
import { setMappedEnvValue } from '../state/actions';

class Environments extends React.Component {
	onFocus(event, fieldset) {
		// console.log('onFocus', event, fieldset);
	}

	onChange(map, data) {
		this.props.onChange(map, data);
	}

	render() {
		console.log('Environments envs', this.props.envs);
		const environments = this.props.envs.map((env, index) => {
			return (
				<Form
					schemas={this.props.schemas}
					env={env}
					envIndex={index}
					key={index}
					onFileSelection={this.props.onFileSelection}
					onFocus={this.onFocus.bind(this)}
					onChange={this.onChange.bind(this)} />
			);
		});

		return (
			<div className="environments">
				{environments}
			</div>
		);
	}
}

Environments.propTypes = {
	currentEnv: PropTypes.string,
	envs: PropTypes.array,
	schemas: PropTypes.object,
	onFileSelection: PropTypes.func,
	onChange: PropTypes.func
};

export function mapStateToProps(state) {
	return {
		currentEnv: state.settings.env,
		envs: state.settings,
		schemas: state.schemas
	};
}

export function mapDispatchToProps(dispatch) {
	return {
		onChange: (map, value) => dispatch(setMappedEnvValue(map, value)),
	};
}

export default connect(
	mapStateToProps,
	mapDispatchToProps
)(Environments);
