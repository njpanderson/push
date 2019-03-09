import merge from 'lodash/merge';
import set from 'lodash/set';

import {
	SET_STATE,
	SET_ACTIVE_ENV,
	ADD_ENV,
	REMOVE_ENV,
	SET_ENV,
	SET_MAPPED_ENV_VALUE,
	SET_ENV_VALUE
} from './actions';

const initialState = {
	settings: [],
	schemas: {},
	filename: ''
};

export default function serviceFile(state = initialState, action) {
	let newState, index;

	switch (action.type) {
	case SET_STATE:
		console.log('new state', action.state);
		return merge({}, state, action.state);

	case SET_ACTIVE_ENV:
		index = findEnvIndex(state, action.id);

		if (index === -1) {
			throw new Error(`Env "${action.id}" must exist within state to be made active.`);
		}

		return setMutexOption(
			state,
			index,
			(env) => env.active = true,
			(env) => env.active = false
		);

	case SET_MAPPED_ENV_VALUE:
		newState = (merge({}, state));
		newState.settings = set(newState.settings, action.map, action.value);
		return newState;

	case ADD_ENV:
		if (findEnvIndex(state, action.id) !== -1) {
			throw new Error(`Env "${action.id}" must exist within state to be edited.`);
		}

		if (!action.service || !action.options) {
			throw new Error(`Env "${action.id}" must contain 'service' and 'options' values.`);
		}

		return merge({}, state, {
			settings: state.settings.concat([{
				id: action.id,
				service: action.service,
				options: action.options,
				active: action.active
			}])
		});

	case SET_ENV:
		// Set env options
		if (findEnvIndex(state, action.id) === -1) {
			throw new Error(`Env "${action.id}" must exist within state to be edited.`);
		}

		if (!action.options) {
			throw new Error(`Env "${action.id}" must contain 'service' and 'options' values.`);
		}

		newState = merge({},...state);
		newState.settings[index] = {
			...newState.settings[index],
			options: {
				...newState.settings[index].options,
				...action.options
			}
		};

		return newState;

	case SET_ENV_VALUE:
		// Change the value for an env
		index = findEnvIndex(state, action.id);

		if (index === -1) {
			throw new Error(`Env "${action.id}" must exist within state to be edited.`);
		}

		newState = merge({}, state);
		newState.settings[index][action.prop] = action.value;
		return newState;

	case REMOVE_ENV:
		// Remove an env
		index = findEnvIndex(action.env);

		if (index === -1) {
			throw new Error(`Env "${action.env}" must exist within state to be removed.`);
		}

		if (getEnvCount(state) === 1) {
			throw new Error(`"${action.env}" is the only only env and cannot be deleted.`);
		}

		// Get state and delete the env
		newState = merge({}, state);

		// Remove the env by its index
		newState.settings.splice(index, 1);

		if (findActiveEnv(newState)) {
			// Deleted env is active - re-set to the first env
			newState.settings[0].active = true;
		}

		return newState;
	}

	return state;
}

/**
 * Return a count of the current environments.
 * @param {object} state - Current state
 */
function getEnvCount(state) {
	return state.settings.length;
}

/**
 * Gets the index of an env by its ID
 * @param {object} state - Current state.
 * @param {string} id - ID of the env to find.
 */
function findEnvIndex(state, id) {
	return state.settings.findIndex((env) => env.id === id);
}

/**
 * Gets the index of the active env.
 * @param {object} state - Current state.
 */
function findActiveEnv(state) {
	return state.settings.findIndex((env) => env.active);
}

/**
 * Runs through the settings of the provided state object and applies
 * the `setter` function on the matching index, or the `altSetter` function
 * on non-matching indices.
 * @param {object} state - Current state.
 * @param {number} index - Index to alter
 * @param {function} setter - Setter function - passed an env object.
 * @param {function} altSetter - Alternate setter function - passed an env object.
 * @returns {object} a new state object.
 */
function setMutexOption(state, index, setter, altSetter) {
	merge({}, state).settings.forEach((env, i) => {
		if (i === index) {
			env = merge({}, setter(env));
		} else {
			env = merge({}, altSetter(env));
		}
	});

	return state;
}
