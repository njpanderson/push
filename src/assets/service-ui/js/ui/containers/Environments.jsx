import { connect } from 'react-redux';

import { getEnvsArray } from '../../lib/utils';
import Environments from '../views/Environments';

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
