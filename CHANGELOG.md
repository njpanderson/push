# Push Changelog
All notable changes to Push will be documented in this file. If this file has appeared within Visual Studio Code, it means that Push has had a notable update. You can easily disable this feature by setting the `njpPush.showChangelog` to `false`.

## 0.6.21
 - Added `semver` dependency. Apologies to all those who found Push disabled this morning!
 - Moved `glob` dependency. Apologies to all those who found Push disabled this morning!

## 0.6.2
 - Improved localisation handling, especially regarding invalid locales.
 - Improved messaging in various places (commands, collission picker).
 - Fixed issue with collission picker not detecting single file uploads.
 - Many Windows path handling improvements.
 - Fixed issue with the environment label not updating in certain scenarios.
 - Fixed issue with environment changes sometimes not registering with the "Compare" command.
 - Improved file error handling in some transfer types.
 - Improved handling of transfer commands when the output window is focused.
 - Various other smaller bugfixes and improvements.

## 0.6.1
 - Fix to path globbing in Windows.

## 0.6.0
 - Added "Upload/queue from commit hash" feature. You can now upload files changed in a specific Git commit.
 - Added nicer icons for uploading, added a title menu upload button.
 - Added option to ignore the project root when traversing upwards for service files.
 - Altered default jsonc file comment to illustrate environments.
 - Improvements to Uri handling across the codebase.
 - Caching improvements.
 - Many smaller improvements and fixes.

## 0.5.2
 - Fixed issue where the output panel would open regardless of whether there was an error during transfers.
 - Fixed issue with messaging when selecting a service environment on files outside of a workspace root.
 - Altered behaviour of CHANGELOG opening to not bother new users.
 - A few other minor fixes.

## 0.5.1
 - Fixed path detection and handling for certain cases in Windows. Sorry, Windows users! (Thanks, Matt!)

## 0.5.0
 - Add support for environments within service configs. This is a big feature, please check the README!
 - Altered the settingsFile configuration somewhat. New service settings files will be named `.push.settings.jsonc` to signify that they can contain comments. Your current service files will still work with the old filename, but if you have customised the filename, please take note of this setting and its partner setting, `settingsFileGlob`.
 - Add persistent watchers. Up to 50 watchers will now be retained between restarts.
 - Add command to create a new service config, regardless of whether one exists.
 - Add Travis integration (mainly to improve automated testing and doc generation).
 - Fixed the default status notice colour - it should now be visible!
 - Fixed deleted handling within the transfer logic for both File and SFTP.
 - Modified error reporting (a lot). Errors should now be clearer and less vague.
 - Modified on demand handling to remove uploaded files from the upload queue.
 - Altered service settings files to comment out optional items by default.
 - Added an option to show this changelog when minor or major releases occur.
 - Various other bugfixes and stability improvements.

## 0.4.61
 - Fix issue with service files not being read correctly. (Thanks, all those that reported.)

## 0.4.6
 - Fix issue with File service template producing the "SFTP" object. (Thanks, tbonzai!)

## 0.4.5
 - Add windows environment variable support to all service `root` properties. (Thanks, ephemerant!)
 - Add autoUploadQueue setting (Thanks, ephemerant!)
 - Make certain file stat collections more reliable.
 - Fix issues with downloading folders from File sources.
 - Better local symlink handling.
 - Add "followSymlinks" option for uploading — this effectively disables the symlink following behaviour by default.
 - Improved some language strings

## 0.4.4
 - Fix issues with transfers to some File service locations on windows.
 - Fix issue with collision detection in the File service.
 - Fix "compare" function in the File service.
 - Security/patch updates in dependencies.

## 0.4.3
 - Fix issue with editing service configs from the command pallet.

## 0.4.2
 - Fix issue with saved files not entering queue.

## 0.4.1
 - Fix issue with scheme detection and insantiating commands from the command pallet.

## 0.4.0
 - Update/simplify wording within some context menus.
 - Add option to queue watched files instead of upload them.
 - Documentation updates.
 - Add warning when using non-file schemes locally.

## 0.3.0
 - Add gateway SSH abilities. See README for more information.
 - Fix queue stopping notification issues.
 - Add function to clear upload queue.
 - Improve status progress labelling.
 - General fixes and improvements.

## 0.2.2
 - Further improvements to error handling. (Including directory listing).

## 0.2.1
 - Improve handling of stream writing on SFTP downloads.

## 0.2
 - Add git support. Will upload files in the working copy.
 - Better handling of SFTP / Disconnect errors.
 - More robust workspace support.
 - Better handling of empty upload queues.
 - General fixes/updates.
 - NPM package updates.

## 0.1.3
 - Add option to remove items from the upload queue.
 - Fix upload queue not showing empty in status bar when uploading.
 - Fix for logic when no editors are open.

## 0.1.2
 - Fix issue with some collision actions skipping regardless of choice.

## 0.1.1
- Add support for key file paasphrase.
- Improve SFTP connection error details.
- Add multilingual support.
- Allow README to exist within extension space.
- Create views for watch and upload queue.
- General improvements to queue management & error handling.
- Improve diff to use a progress spinner when downloading files.

## 0.1.0
- Initial release.
