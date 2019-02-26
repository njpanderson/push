import merge from 'lodash/merge';
import set from 'lodash/set';
import { FIELDS } from '../../../../lib/constants/static';

/**
 * Returns a list of environments as an array
 * @param {object} state - Current state.
 */
export function getEnvsArray(state) {
	const envs = Object.keys(state).filter(env => env !== 'env');
	return envs.map(env => ({ ...state[env], id: env }));
}

/**
 * @description
 * Sets the value into a `state` container by using the `map` map as a position
 * reference
 * @param {object|array} state
 * @param {array} map
 * @param {*} value
 */
export function setMappedValue(state, map, value) {
	return set(merge(Array.isArray(state) ? [] : {}, state), map, value);
}

/**
 * Retreive a default field value, ensuring it is type safe
 * @param {object} field - Field definition
 */
export function getFieldDefault(field) {
	if (field && field.hasOwnProperty('default')) {
		return field.default;
	} else {
		switch (field.type) {
		case FIELDS.NUMBER:
			return 0;
		case FIELDS.GRID:
			return [];
		default:
			return '';
		}
	}
}

/**
 * Returns whether or not the key name is internal (i.e. not for data storage)
 * @param {string} key - The key name to test
 */
export function isInternalKey(key) {
	return key === '_id';
}

/**
 * Strips any internal values from the value data.
 * @param {array} value - Value data
 * TODO: flesh out more reusable version of this for global use
 */
export function stripInternalKeys(value = []) {
	return value.map((set) => {
		let key;

		for (key in set) {
			if (isInternalKey(key)) {
				delete set[key];
			}
		}

		return set;
	});
}
