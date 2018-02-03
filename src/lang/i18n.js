const vscode = require('vscode');

const utils = require('../lib/utils');
const config = require('../lib/config');

/**
 * Internationalisation (i18n) class.
 * Language files are a combination of ISO 639-1 language codes and ISO 3166-1
 * Alpha-2 codes of country names. Country code is optional if a language does not
 * require that definition, e.g. 'ja' (Japanese) vs 'en_gb' (British English).
 */
class i18n {
	constructor() {
		this._locale;

		this.re = {
			has_placeholders: /(\$|p)\{\d+\}/
		};

		this.strings = {
			base: require(`./en_gb`),
			localised: {}
		};

		this.setLocale();

		vscode.workspace.onDidChangeConfiguration(() => this.setLocale());
	}


	setLocale(locale) {
		let fileName;

		locale = locale || config.get('locale');
		fileName = `./${locale}`;

		try {
			this.strings.localised = require(fileName);
			this._locale = locale;
			return;
		} catch(e) {
			throw new Error(this.t('no_locale', locale));
		}
	}

	/**
	 * Fetch a string in the current locale
	 * @param {string} key - String key from the relevant translation file.
	 * @param {...mixed} $1 - Replacement variables, to replace with indexed matches
	 * in the string value.
	 */
	t(key) {
		let string = this.getLocalisedString(key);

		if (this.re.has_placeholders.test(string)) {
			[...arguments].slice(1).forEach((value, index) => {
				string = string.replace(
					RegExp('\\$\\{' + (index + 1) + '\\}', 'g'),
					value
				);
				string = string.replace(
					RegExp('p\\{' + (index + 1) + '\\:([^:]+)\\:([^\\}]+)\\}', 'g'),
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

	getLocalisedString(key) {
		if (this.strings.localised[key]) {
			return this.strings.localised[key];
		}

		return this.strings.base[key];
	}
};

module.exports = new i18n();