/* global acquireVsCodeApi */
import React from 'react';
import ReactDOM from 'react-dom';
import { createStore } from 'redux';
import { Provider } from 'react-redux';

import serviceFile from './state/reducers';
import WebMessaging from '../../../../messaging/WebMessaging';
import {
	setState,
	addEnv,
	setMappedEnvValue
} from './state/actions';
import { COMMS } from '../../../../lib/constants/static';

// React
import Environments from './containers/Environments';
import Toolbar from './views/Toolbar';

const store = createStore(serviceFile);
const vscode = acquireVsCodeApi();

class Root extends React.Component {
	constructor() {
		super();

		this.messaging = new WebMessaging(vscode);
		this.messaging.onReceive(this.receiveMessage.bind(this));

		// Send intiialisation ping
		this.messaging.post(COMMS.VIEW_INIT);
	}

	/**
	 * Receives messages from the SettingsUI class.
	 * @param {string} type - Message type
	 * @param {*} data - Message data
	 */
	receiveMessage(type, data) {
		switch (type) {
		case COMMS.SET_INITIAL_STATE:
			store.dispatch(setState(data));
			break;

		case COMMS.SET_FILE_SELECTION:
			console.log('SET_FILE_SELECTION', data);
			store.dispatch(setMappedEnvValue(data.map, data.file));
			// this.messaging.post(COMMS.GET_FILE_SELECTION);
			// store.dispatch(setState(data));
			break;
		}
	}

	/**
	 * Create a new env with a unique state name
	 */
	addEnv() {
		const state = store.getState(),
			envs = Object.keys(state.settings).filter(
				key => key.startsWith('new_env')
			);

		let a = 1,
			newEnvName = 'new_env_' + a;

		// Find a unique name
		while (envs.findIndex(key => key === newEnvName) !==-1) {
			newEnvName = 'new_env_' + ++a;
		}

		// Dispatch change
		store.dispatch(addEnv(
			newEnvName,
			{
				service: 'File',
				options: {}
			}
		));
	}

	getButtons() {
		return [[{
			label: 'Add',
			onClick: this.addEnv.bind(this)
		}], [{
			label: 'Cancel',
			onClick: () => {
				console.log('button cancel');
			}
		}, {
			label: 'Save',
			onClick: () => {
				console.log('button save');
			}
		}]];
	}

	getFileSelection(options = {}) {
		this.messaging.post(COMMS.GET_FILE_SELECTION, options);
	}

	render() {
		console.log('root render');
		return (
			<div className='container'>
				<Toolbar heading="Push service settings" buttons={this.getButtons()}/>
				<Environments
					onFileSelection={this.getFileSelection.bind(this)}/>
				<Toolbar buttons={this.getButtons()}/>
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
