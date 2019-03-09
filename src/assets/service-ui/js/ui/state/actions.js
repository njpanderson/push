// Global actions
export const SET_STATE = 'SET_STATE';
export const SET_ACTIVE_ENV = 'SET_ACTIVE_ENV';
export const SET_MAPPED_ENV_VALUE = 'SET_MAPPED_ENV_VALUE';

// Environment specific actions
export const ADD_ENV = 'ADD_ENV';
export const REMOVE_ENV = 'REMOVE_ENV';
export const SET_ENV = 'SET_ENV';
export const SET_ENV_SERVICE = 'SET_ENV_SERVICE';
export const SET_ENV_VALUE = 'SET_ENV_VALUE';

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

export function setMappedEnvValue(map, value) {
	console.log('setMappedEnvValue', map, value);
	return {
		type: SET_MAPPED_ENV_VALUE,
		map,
		value
	};
}

/**
 * Set the active environment for the service file.
 * @param {string} env - The environment to set. Must exist within the state.
 */
export function setActiveEnv(env) {
	return {
		type: SET_ACTIVE_ENV,
		env
	};
}

/**
 * Create a single env element in the service file.
 * @param {string} id - The environment ID to add. Must not exist within the state.
 */
export function addEnv(id, service, options, active = false) {
	return {
		type: ADD_ENV,
		id,
		service,
		options,
		active
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
 * @param {string} id - The env to set. Must exist within the state.
 * @param {object} options - The options to set for the named env.
 */
export function setEnv(id, options) {
	return {
		type: SET_ENV,
		id,
		options
	};
}

/**
 * Set id for a single env.
 * @param {string} id - The env to set. Must exist within the state.
 * @param {string} value - The new ID to give the env.
 */
export function renameEnv(id, value) {
	return {
		type: SET_ENV_VALUE,
		id,
		prop: 'id',
		value
	};
}

/**
 * Set the service option for a single env.
 * @param {string} id - Env ID to set. Must exist within the state.
 * @param {string} value - The service name to set for the env.
 */
export function setEnvService(id, value) {
	return {
		type: SET_ENV_VALUE,
		id,
		prop: 'service',
		value
	};
}
