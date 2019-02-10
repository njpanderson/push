/* eslint-disable no-unused-vars */
import React from 'react';
import ReactDOM from 'react-dom';

import Form from './containers/Form';

class Root extends React.Component {
	render() {
		return (
			<div className="container">
				<h1>Root component</h1>
				<Form/>
			</div>
		);
	}
}

ReactDOM.render(
	<Root/>,
	document.getElementById('root')
);
