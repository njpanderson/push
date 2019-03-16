import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import Select from '../views/components/Select';
import TextField from '../views/fields/TextField';
import {
	setEnvService,
	renameEnv
} from '../state/actions';

class FormToolbar extends React.Component {
	onEnvSelect(value) {
		this.props.onEnvSelect(this.props.env.id, value);
	}

	onEnvRename(event, value) {
		this.props.onEnvRename(this.props.env.id, value);
	}

	render() {
		return (
			<div className="toolbar">
				<div className="text">
					<TextField
						label="Environment name"
						onChange={this.onEnvRename.bind(this)}
						className="field--heading field--large"
						value={this.props.env.id} />
				</div>

				<nav>
					<div className="group">
						<Select
							className="service-selector"
							onChange={this.onEnvSelect.bind(this)}
							value={this.props.env.service}
							options={this.props.serviceOptions} />
					</div>
				</nav>
			</div>
		);
	}
}

FormToolbar.propTypes = {
	env: PropTypes.object,
	serviceOptions: PropTypes.array,
	onEnvSelect: PropTypes.func,
	onEnvRename: PropTypes.func
};

export function mapStateToProps(state) {
	return {
		serviceOptions: Object.keys(state.schemas).map((type) => {
			return ({
				value: type,
				label: type
			});
		})
	};
}

export function mapDispatchToProps(dispatch) {
	return {
		onEnvSelect: (env, service) => dispatch(setEnvService(env, service)),
		onEnvRename: (env, id) => dispatch(renameEnv(env, id))
	};
}

export default connect(
	mapStateToProps,
	mapDispatchToProps
)(FormToolbar);
