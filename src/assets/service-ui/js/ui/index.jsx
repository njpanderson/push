/* global acquireVsCodeApi */
/* eslint-disable no-unused-vars */
import React from 'react';
import ReactDOM from 'react-dom';
import { createStore } from 'redux';
import { Provider } from 'react-redux';

import serviceFile from './state/reducers';
import { setState } from './state/actions';
import { COMMS } from '../../../../lib/constants/static';
import WebMessaging from '../../../../messaging/WebMessaging';

// React
import Environments from './containers/Environments';

const store = createStore(serviceFile);

// store.dispatch(setState({
// 	schemas: {},
// 	settings: {
// 		env: 'dev',
// 		dev: {
// 			service: 'SFTP',
// 			options: {
// 				host: 'raspberrypi.local',
// 				username: 'pushtest',
// 				root: '/home/pushtest/jsonc-prod/dev',
// 				followSymlinks: true,
// 				testCollisionTimeDiffs: false
// 			}
// 		},
// 		prod: {
// 			service: 'SFTP',
// 			options: {
// 				host: 'neilinscotland.net',
// 				username: 'push-test',
// 				root: '/home/push-test/jsonc-prod/prod',
// 				followSymlinks: true,
// 				testCollisionTimeDiffs: false
// 			}
// 		}
// 	}
// }));

class Root extends React.Component {
	constructor() {
		super();

		this.messaging = new WebMessaging(acquireVsCodeApi());
		this.messaging.onReceive(this.receiveMessage.bind(this));

		// Send intiialisation ping
		this.messaging.post(COMMS.VIEW_INIT);
	}

	receiveMessage(type, data) {
		console.log('message received!', type, data);

		switch (type) {
		case COMMS.SET_INITIAL_STATE:
			console.log('state received!', data);
			store.dispatch(setState(data));
			break;
		}
	}

	render() {
		return (
			<div className='container'>
				<h1>Push service settings</h1>
				<Environments />
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
