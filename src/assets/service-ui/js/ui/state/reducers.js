import {
	SET_STATE,
	SET_CURRENT_ENV,
	ADD_ENV,
	REMOVE_ENV,
	SET_ENV
} from './actions';

const initialState = {
	settings: {
		env: ''
	},
	schemas: {}
};

export default function serviceFile(state = initialState, action) {
	let newState;

	switch (action.type) {
	case SET_STATE:
		return {...state, ...action.state};

	case SET_CURRENT_ENV:
		return {
			...state,
			settings: {
				...state.settings,
				env: action.env
			}
		};

	case ADD_ENV:
	case SET_ENV:
		if (action.type === SET_ENV && !state.settings[action.env]) {
			throw new Error(`Env "${action.env}" must exist within state to be edited.`);
		} else if (action.type === ADD_ENV && state.settings[action.env]) {
			throw new Error(`Env "${action.env}" exists within state. It cannot be added.`);
		}

		if (!action.data.service || !action.data.options) {
			throw new Error(`Env "${action.env}" must contain 'service' and 'options' values.`);
		}

		return {
			...state,
			settings: {
				...state.settings,
				[action.env]: action.data
			}
		};

	case REMOVE_ENV:
		if (!state.settings[action.env]) {
			throw new Error(`Env "${action.env}" must exist within state to be removed.`);
		}

		if (getEnvCount(state) === 1) {
			throw new Error(`"${action.env}" is the only only env and cannot be deleted.`);
		}

		// Get state and delete the env
		newState = {...state};
		delete newState.settings[action.env];

		if (newState.settings.env === action.env) {
			// Current env is set to the deleted env - re-set to the first env
			newState.settings.env = getFirstEnv(newState);
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
	return (Object.keys(state.settings).filter(key => key !== 'env')).length;
}

/**
 * Return a count of the current environments
 * @param {object} state - Current state
 */
function getFirstEnv(state) {
	return (Object.keys(state.settings).find(key => key !== 'env'));
}
