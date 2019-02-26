import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import Form from '../views/Form';
import { getEnvsArray } from '../../lib/utils';

class Environments extends React.Component {
	onFocus(event, fieldset) {
		// console.log('onFocus', event, fieldset);
	}

	onChange(env, data) {
		// console.log('onChange', env, data);
	}

	render() {
		const environments = this.props.envs.map((env) => {
			console.log('env render', env);
			return (
				<Form
					schemas={this.props.schemas}
					env={env}
					key={env.id}
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
	onFileSelection: PropTypes.func
};

export function mapStateToProps(state) {
	return {
		currentEnv: state.settings.env,
		envs: getEnvsArray(state.settings),
		schemas: state.schemas
	};
}

export function mapDispatchToProps(dispatch) {
	return {

	};
}

export default connect(
	mapStateToProps,
	mapDispatchToProps
)(Environments);
