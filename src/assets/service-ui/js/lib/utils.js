/**
 * Returns a list of environments as an array
 * @param {object} state - Current state.
 */
export function getEnvsArray(state) {
	const envs = Object.keys(state).filter(env => env !== 'env');
	return envs.map(env => state[env]);
}
