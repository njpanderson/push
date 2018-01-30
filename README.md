# Push

**Note: This extension is under heavy development and should be considered pre-alpha. Do not use unless you are happy to potentially lose data within your VS Code workspaces.**

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
* `njpPush.privateSSHKey`: Set the location of your private .ssh key. Will attempt to locate within the local .ssh folder by default.

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

## Available services

### SFTP

| Setting | Default | Description |
| --- | --- | --- |
| `host` | | Hostname or IP of the remote host. |
| `username` | | Username of the authenticated user. |
| `password` | | Password for the authenticated user. Leave blank if using keys. |
| `privateKey` | | Private key path, if using keys. Defaults to the global `privateKey` setting. |
| `root` | `/` | The root path to upload to. All files within the workspace at the same level or lower than the location of the server settings file will upload into this path. |
| `keepaliveInterval` | `3000` | How often, in milliseconds, to send keep-alive packets to the server. Set `0` to disable. |
| `fileMode` | | If required, a [mode](https://en.wikipedia.org/wiki/File_system_permissions#Numeric_notation) can be applied to files when they are uploaded. Numeric modes are accepted. E.g: `"700"` to give all access to the owner only. An array of modes is also supported. (See below.) |
| `debug` | `false` | In debug mode, extra information is sent from the underlying SSH client to the console.

#### `fileMode` as an array

The `fileMode` setting of the SFTP service can also be expressed as an array of glob strings and modes required. For instance:

```
	...
	"fileMode": [{
		"glob": "*.txt",
		"mode": "600"
	}, {
		"glob": "*.jpg",
		"mode": "700"
	}, {
		"glob": "**/*/",
		"mode": "655"
	}]
```

The above example will perform the following:

 - Filenames ending in **.txt** will be given the mode `600`
 - Filenames ending in **.jpg** will be given the mode `700`
 - **All directories** will be given the mode `655`

For those in the know, the underlying glob matching is performed by [micromatch](https://www.npmjs.com/package/micromatch#matching-features), and any glob pattern it supports can be used here.

### File

| Setting | Default | Description |
| --- | --- | --- |
| `root` | `/` | The root path to upload to. All files within the workspace at the same level or lower than the location of the server settings file will upload into this path. |

### General service settings
The following options are available to all services:

| Setting | Default | Description |
| --- | --- | --- |
| `testCollisionTimeDiffs` | `true` | If this option is set to `false`, the service will assume newer files collide, which means all files that exist on the remote will produce a collision warning. |
| `collisionUploadAction` | (Prompt) | Sets how to proceed when colliding with the same remote file. Set one of `stop` (Stop transfer entirely), `skip` (Skip the file), `overwrite` (Overwrite the file), or `rename` (Keep both files by renaming the source file). This option is ignored if the file type (directory or file) does not match the target.
| `collisionDownloadAction` | (Prompt) | Identical in options to `collisionUploadAction`, sets how to proceed when colliding with the same local file.
| `timeZoneOffset` | `0` | The offset, in hours, the time is set to on the origin relative to the local device. I.e. if the origin is GMT+1 and the device is GMT-1, the offset would be `2` |

## Known Issues

None at present.

## Release Notes

### 0.1.0

(Not yet released)