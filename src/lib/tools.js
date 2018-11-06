/**
 * Tools with no external dependencies.
 */
module.exports = {
	/**
	 * Returns an array with only unique values.
	 * @param {array} arrayData - The array to process
	 */
	uniqArray: function (arrayData) {
		return arrayData.filter((e, i, a) => {
			return (a.indexOf(e) === i);
		});
	}
};
