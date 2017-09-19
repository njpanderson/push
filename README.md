# Push

Push is a file transfer extension. It is inspired in part by Sublime's fantastic SFTP plugin, and provides you with a tool to upload and download files within a workspace.

## Features

It currently provides:

 - Transfer of individual files
 - Transfer of folders
 - Queueing (and transfer after save bulk)
 - Watching of files within the project

## Extension Settings

This extension contributes the following settings:

* `njpPush.settingsFilename`: Settings file name. Defaults to `.push.settings.json`.
* `njpPush.privateKey`: Set the default location of your private .ssh key. Used by the `SFTP` service.

## Server settings files

To customise the server settings for a workspace, add a file (by default, called `.push.settings.json`) to your workspace with the following format:

```
{
	"service": "[ServiceName]",
	"[ServiceName]": {
		...
	}
}
```

Each available service has its own set of settings which are within the `[ServiceName]` object on the main server settings object. For instance, if using the `SFTP` service, your config might look something like this:

```
{
	"service": "SFTP",
	"SFTP": {
		"host": "upload.bobssite.com",
		"username": "bob"
		"password": "xxxxxxx",
		"root": "/home/bob"
	}
}
```

### Server settings file locations

When defining a server settings file, placing it in the root of your workspace will define those settings for the whole workspace. Push also supports adding server settings files to sub-diretories within your workspace. When uploading files from within any directory, Push will look for the nearest server settins file and use it for server-specific settings.

### Available services

#### `SFTP`

| Setting | Description |
| --- | --- |
| `host` | Hostname or IP of the remote host |
| `username` | Username of the authenticated user |
| `password` | Password for the authenticated user. Leave blank if using keys |
| `privateKey` | Private key path, if using keys. Defaults to the global `privateKey` setting |
| `root` | The root path to upload to. All files within the workspace at the same level or lower than the location of the server settings file will upload into this path |

### Service options

## Known Issues

None at present.

## Release Notes

### 1.0.0

Initial release