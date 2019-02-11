/* global acquireVsCodeApi */
/* eslint-disable no-unused-vars */
import React from 'react';
import ReactDOM from 'react-dom';
import { createStore } from 'redux';
import { Provider } from 'react-redux';

import serviceFile from './state/reducers';
import { setState } from './state/actions';
import { COMMS } from '../../../../lib/constants/static';
import messaging from '../../../../lib/messaging';

// React
import Form from './containers/Form';

const store = createStore(serviceFile);
const vscode = acquireVsCodeApi();

store.dispatch(setState({
	env: 'dev',
	dev: {
		service: 'SFTP',
		options: {
			host: 'raspberrypi.local',
			username: 'pushtest',
			root: '/home/pushtest/jsonc-prod/dev',
			followSymlinks: true,
			testCollisionTimeDiffs: false
		}
	},
	prod: {
		service: 'SFTP',
		options: {
			host: 'neilinscotland.net',
			username: 'push-test',
			root: '/home/push-test/jsonc-prod/prod',
			followSymlinks: true,
			testCollisionTimeDiffs: false
		}
	}
}));

class Root extends React.Component {
	constructor() {
		super();

		// vscode.postMessage('hello!');

		window.addEventListener('message', this.receiveMessage, false);
	}

	receiveMessage(event) {
		switch (messaging.getMessageType(event.data)) {
		case COMMS.TASK_INITIAL_STATE:
			console.log(event.data);
			// store.dispatch(setState(
			// 	messaging.getMessageData(event.data)
			// ));
			break;
		}
		// vscode.postMessage('hello host!');
	}

	render() {
		return (
			<div className='container'>
				<h1>Push service settings</h1>
				<Form />
			</div>
		);
	}
}

ReactDOM.render(
	<Provider store={store}>
		<Root />
	</Provider>,
	document.getElementById('root')
);
