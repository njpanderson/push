# Push

**Note: This extension is under heavy development and should be considered pre-alpha. Do not use unless you are happy to potentially lose data within your VS Code workspaces.**

Push is a file transfer extension. It is inspired in part by Sublime's fantastic SFTP plugin as well as Coda's workflow features, and provides you with a tool to upload and download files within a workspace.

## Features

It currently provides:

 - Transfer of individual files
 - Transfer of folders
 - Queueing (and transfer after save bulk)
 - Watching of files within the project

## Extension Settings

This extension contributes the following settings:

| Setting | Default | Description |
| --- | --- | --- |
| `locale` | `en-gb` | Language file to use. Currently, only English (British) is supported.
| `settingsFilename` | `.push.settings.json` | Settings file name. Defaults to `.push.settings.json`. |
| `debugMode` | `false` | Enable debug mode for more logging. Useful if reporting errors. |
| `privateSSHKey` | (Empty) | Set the location of your private .ssh key. Will attempt to locate within the local .ssh folder by default. |
| `uploadQueue` | `true` | If enabled, uses an upload queue, allowing you to upload all saved files since the last push. |
| `ignoreGlobs` | `**/.DS_Store`,<br>`**/Thumbs.db`,<br>`**/desktop.ini`,<br>`**/.git/\*`,<br>`**/.svn/*` | A list of file globs to ignore when uploading. |
| `queueCompleteMessageType` | `status` | Choose how to be notified on queue completion. Either `status`, or `message` for a permanent reminder. |
| `statusMessageColor` | `notification.`<br>`infoBackground` | Choose the colour of the queue completion status message. |

## Using Push
Push has three main modes of operation: 1) As a standard, on-demand uploader, 2) as a queue-based uploader on save, or 3) as a file watching uploader. All three can be combined or ignored as your preferences dictate.

### How does Push upload?

When Push uploads a file within the workspace, it does a few things to make sure the file gets into the right place on your remote location - regardless of which service is used:

 1. Find the nearest `.push.settings.json` (or equivalent) to the file. Push will look upwards along the ancestor tree of the file to find this.
 2. Connect to the service required and find the root path as defined.
 3. Use the root path as a basis for uploading the file at its own path, relative to the workspace.
 4. Upload the file.

#### Root path resolving

If, for instance, an SFTP connection has been defined in the settings file for your workspace, and it has a `root` of `/home/myaccount/public`, all files in your workspace will be uploaded to there as a base path. 

For instance, if your workspace root was `/Users/myusername/Projects/myproject/` and the file you uploaded was at `<workspace>/contact/index.php`, then it would end up being uploaded to `/home/myaccount/public/contact/index.php`.

### On demand uploading

There are a few methods you can use to upload on-demand. Two of which are the command palette, and the context menu in the file explorer, seen below:

**Command palette:**

![Uploading with the command Palette](/img/command-palette-upload.png?raw=true)

**Context menu:**

![Uploading with the context menu](/img/context-upload.png?raw=true)

The same two methods can be used to perform downloads, as well as most of the other features of Push.

### Queued uploading

Another great feature of Push is that it will keep a list of all files you have edited within VS Code and let you upload them with a single shortcut. This defaults to `cmd-alt-p` (or `ctrl-alt-p` on Windows).

Whenever a file is saved, and the queue is enabled, a small ![Upload queue](/img/repo-push.svg?raw=true) icon with the number of queued items will appear in the status bar.

![Status bar with files in the queue](/img/status-has-queue.png?raw=true)

Use the above shortcut, or select "Upload queued items" in the command palette to upload all of the files in a single operation.

### File watching

A third method of uploading files is to use the watch tool. This can be accessed from the explorer context menu:

![Context menu with watch selected](/img/context-watch.png?raw=true)

Selecting this option will create a watcher for the file, or in the case of a folder, all of the files within it. Whenever any one of them is altered or created by either VS Code or another app, Push will attempt to upload them.

#### Listing watched files

If you loose track of which files and folders are being watched, either click on the icon in the status bar:



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

## Localising push

If you are keen on getting Push into your language, and understand JavaScript - get in touch if you're interesting in helping to localise Push. Just start an issue with your details and we can work something out.