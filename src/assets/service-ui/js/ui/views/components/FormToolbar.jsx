import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';

import Select from './Select';

function FormToolbar(props) {
	return (
		<div className="toolbar">
			<div className="text">
				<input
					type="text"
					className="field--text field--heading field--large"
					title="Environment name"
					defaultValue={props.env.id} />
			</div>

			<nav>
				<div className="group">
					<Select
						className="service-selector"
						options={props.serviceOptions} />
				</div>
			</nav>
		</div>
	);
}

FormToolbar.propTypes = {
	env: PropTypes.object,
	serviceOptions: PropTypes.array
};

export default FormToolbar;
