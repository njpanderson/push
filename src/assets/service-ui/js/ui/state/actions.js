// Global actions
export const SET_STATE = 'SET_STATE';
export const SET_CURRENT_ENV = 'SET_CURRENT_ENV';

// Environment specific actions
export const ADD_ENV = 'ADD_ENV';
export const REMOVE_ENV = 'REMOVE_ENV';
export const SET_ENV = 'SET_ENV';

/**
 * Set the initial state for the entire service file.
 * @param {object} state - The state as defined in a service file.
 */
export function setState(state) {
	return {
		type: SET_STATE,
		state
	};
}

/**
 * Set the current environment for the service file.
 * @param {string} env - The environment to set. Must exist within the state.
 */
export function setCurrentEnv(env) {
	return {
		type: SET_CURRENT_ENV,
		env
	};
}

/**
 * Create a single env element in the service file.
 * @param {string} env - The environment to add. Must not exist within the state.
 */
export function addEnv(env, data) {
	return {
		type: ADD_ENV,
		env,
		data
	};
}

/**
 * Remove a single env element from the service file.
 * @param {string} env - The environment to remove. Must exist within the state.
 */
export function removeEnv(env) {
	return {
		type: REMOVE_ENV,
		env
	};
}

/**
 * Set env data for a single env.
 * @param {string} env - The env to set. Must exist within the state.
 * @param {object} data - The data to set for the named env.
 */
export function setEnv(env, data) {
	return {
		type: SET_ENV,
		env,
		data
	};
}
