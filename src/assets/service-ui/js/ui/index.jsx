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
			// Set the initial state from the service file
			store.dispatch(setState(data));
			break;

		case COMMS.SET_FILE_SELECTION:
			// Set a file selection from the field by its map
			store.dispatch(setMappedEnvValue(data.map, data.file));
			break;
		}
	}

	/**
	 * Create a new env with a unique state name
	 */
	addEnv() {
		const state = store.getState(),
			envs = state.settings.filter(
				env => env.id.startsWith('new_env')
			);

		let a = 1,
			newEnvId = 'new_env_' + a;

		// Find a unique name
		while (envs.findIndex(env => env.id === newEnvId) !== -1) {
			newEnvId = 'new_env_' + ++a;
		}

		// Dispatch change
		store.dispatch(addEnv(newEnvId, 'File', {}));
	}

	getButtons() {
		return [[{
			label: 'Add',
			onClick: this.addEnv.bind(this)
		}], [{
			label: 'Cancel',
			onClick: () => this.close()
		}, {
			label: 'Save',
			onClick: () => this.save()
		}, {
			label: 'Save & close',
			onClick: () => this.save(true)
		}]];
	}

	save(close = false) {
		const state = store.getState();

		// Validate settings
		// TODO:...

		this.messaging.post(COMMS.SAVE, {
			settings: state.settings,
			filename: state.filename
		});

		if (close) {
			this.close();
		}
	}

	close() {
		this.messaging.post(COMMS.CLOSE);
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
