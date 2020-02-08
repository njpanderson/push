const vscode = require('vscode');
const moment = require('moment');

const config = require('../lib/config');
const {
	PUSH_MESSAGE_PREFIX
} = require('../lib/constants');
const locales = {
	en_gb: require('./locales/en_gb'),
	it: require('./locales/it'),
	ja: require('./locales/ja')
};

/**
 * Internationalisation (i18n) class.
 * Language files are a combination of ISO 639-1 language codes and ISO 3166-1
 * Alpha-2 codes of country codes. Country code is optional if a language does not
 * require that definition, e.g. 'ja' (Japanese) vs 'en_gb' (British English).
 */
class i18n {
	constructor() {
		// Set default, current locale
		this._default_locale = 'en_gb';
		this._locale = 'en_gb';

		this.strings = {
			base: locales.en_gb,
			localised: {}
		};

		this.setLocale();

		vscode.workspace.onDidChangeConfiguration(() => this.setLocale());
	}

	/**
	 * Set the currently active locale.
	 * @param {string} locale - The active locale to set.
	 */
	setLocale(locale) {
		locale = locale || config.get('locale');

		try {
			this.strings.localised = locales[locale];
			this._locale = locale;

			return;
		} catch(e) {
			this.strings.localised = {...this.strings.base};
			this._locale = this._default_locale;

			// Display an error
			vscode.window.showErrorMessage(PUSH_MESSAGE_PREFIX + this.t('no_locale', locale));
		}
	}

	moment(dateTime) {
		if (this._locale !== 'en_gb') {
			moment.locale(this._locale.replace(/_/, '-'));
		}

		return moment(dateTime);
	}

	/**
	 * Fetch a translated string in the current locale
	 * @param {string} key - String key from the relevant translation file.
	 * @param {...mixed} $1 - Replacement variables, to replace with indexed matches
	 * in the string value.
	 */
	t(key) {
		let string = this.getLocalisedString(key);

		if (i18n.tests.has_placeholders.test(string)) {
			[...arguments].slice(1).forEach((value, index) => {
				string = string.replace(
					RegExp('\\$\\{' + (index + 1) + '\\}', 'g'),
					value
				);
				string = string.replace(
					RegExp('p\\{' + (index + 1) + '\\:([^:]*)\\:([^\\}]*)\\}', 'g'),
					(typeof value === 'number' && value !== 1) ? '$2' : '$1'
				);
			});
		}

		return string;
	}

	/**
	 * Translates an object of key/value pairs
	 * @param {Object} object - The object to translate. The values of which should
	 * match those sent to i18n#t.
	 * @param {Object} params - An object containining key/value pairs of the keys
	 * being translated and array values of replacement variables.
	 */
	o(object, params) {
		let key;

		for (key in object) {
			object[key] = this.t.apply(
				this,
				(
					params && params[key] ?
						[object[key]].concat(
							params[key] || []
						) :
						[object[key]]
				)
			);
		}

		return object;
	}

	/**
	 * @description
	 * Returns the localised string for a key. Will return the base key with markings if a localised
	 * or the base key cannot be found.
	 * @param {string} key - String key to fetch.
	 * @returns {string} The found localised string.
	 */
	getLocalisedString(key) {
		if (this.strings.localised[key]) {
			return this.strings.localised[key];
		}

		if (this.strings.base[key]) {
			return this.strings.base[key];
		}

		return `!!${key}!!`;
	}
}

i18n.tests = {
	has_placeholders: /(\$|p)\{\d+\}/
};

module.exports = new i18n();
