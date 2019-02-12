import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';
import Form from './Form';

function Environments(props) {
	const environments = props.envs.map((env) => {
		return (
			<Form env={env} key={env.id} />
		);
	});

	return (
		<div className="environments">
			{environments}
		</div>
	);
}

Environments.propTypes = {
	currentEnv: PropTypes.string,
	envs: PropTypes.array
};

export default Environments;
