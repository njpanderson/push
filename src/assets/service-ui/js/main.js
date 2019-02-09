const vscode = acquireVsCodeApi();

vscode.postMessage('hello!');

window.addEventListener('message', function(event) {
	console.log('Message received: ' + event.data);
	vscode.postMessage('hello host!');
}, false);
