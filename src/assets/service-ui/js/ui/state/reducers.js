import {
	SET_STATE,
	SET_CURRENT_ENV,
	ADD_ENV,
	REMOVE_ENV,
	SET_ENV
} from './actions';

const initialState = {
	env: ''
};

export default function serviceFile(state = initialState, action) {
	let newState;

	console.log('reducers/serviceFile', state, action);

	switch (action.type) {
	case SET_STATE:
		return {...state, ...action.state};

	case SET_CURRENT_ENV:
		return {...state, env: action.env};

	case ADD_ENV:
	case SET_ENV:
		if (action.type === SET_ENV && !state[action.env]) {
			throw new Error(`Env "${action.env}" must exist within state to be edited.`);
		} else if (action.type === ADD_ENV && state[action.env]) {
			throw new Error(`Env "${action.env}" exists within state. It cannot be added.`);
		}

		if (!action.data.service || !action.data.options) {
			throw new Error(`Env "${action.env}" must contain 'service' and 'options' values.`);
		}

		return {
			...state,
			[action.env]: action.data
		};

	case REMOVE_ENV:
		if (!state[action.env]) {
			throw new Error(`Env "${action.env}" must exist within state to be removed.`);
		}

		if (getEnvCount(state) === 1) {
			throw new Error(`"${action.env}" is the only only env and cannot be deleted.`);
		}

		// Get state and delete the env
		newState = {...state};
		delete newState[action.env];

		if (newState.env === action.env) {
			// Current env is set to the deleted env - re-set to the first env
			newState.env = getFirstEnv(newState);
		}

		return newState;
	}

	return state;
}

/**
 * Return a count of the current environments
 * @param {object} state - Current state
 */
function getEnvCount(state) {
	return (Object.keys(state).filter(key => key !== 'env')).length;
}

/**
 * Return a count of the current environments
 * @param {object} state - Current state
 */
function getFirstEnv(state) {
	return (Object.keys(state).find(key => key !== 'env'));
}
