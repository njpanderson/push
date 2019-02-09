class SettingsUI {
	show() {
		this.panel = vscode.window.createWebviewPanel(
			'push.serviceSettings',
			'Push Service Settings',
			vscode.ViewColumn.One,
			{
				enableScripts: true
			}
		);

		this.panel.webview.html = ;

		this.panel.webview.onDidReceiveMessage((event) => {
			console.log('message from webview!');
			console.log(event);
		});

		this.panel.webview.postMessage('hello webview!');
	}
}

module.exports = SettingsUI;
