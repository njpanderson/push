import { connect } from 'react-redux';

import { getEnvsArray } from '../../lib/utils';
import Environments from '../views/Environments';

export function mapStateToProps(state) {
	console.log(getEnvsArray(state));
	return {
		currentEnv: state.env,
		envs: getEnvsArray(state)
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
