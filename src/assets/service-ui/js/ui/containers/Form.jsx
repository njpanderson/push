import { connect } from 'react-redux';

import { getEnvsArray } from '../../lib/utils';
import Form from '../views/Form';

export function mapStateToProps(state) {
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
)(Form);
