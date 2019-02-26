import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';

import Button from './components/Button';

function Toolbar(props) {
	let heading = '',
		buttons = [];

	if (props.heading !== '') {
		heading = (
			<div className="text">
				<h1>{props.heading}</h1>
			</div>
		);
	}

	buttons = (props.buttons || []).map((group, index) => (
		<div key={index} className="group">
			{group.map(
				(button, index) => (
					<Button
						key={index}
						label={button.label}
						onClick={button.onClick} />
				)
			)}
		</div>
	));

	return (
		<div className="toolbar">
			{heading}

			<nav>
				{buttons}
			</nav>
		</div>
	);
}

Toolbar.propTypes = {
	heading: PropTypes.string,
	buttons: PropTypes.arrayOf(
		PropTypes.arrayOf(
			PropTypes.shape({
				label: PropTypes.string,
				onClick: PropTypes.func
			})
		)
	)
};

export default Toolbar;
