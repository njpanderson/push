# Contributing

Firstly, thank you for considering a contribution to Push!

Push uses Git flow, in that the tip of the `master` branch is considered to be the current latest release of Push. Any and all contributions should be merged into `develop`.

## Environment

Push is a VS Code extension. If you are unfamiliar with the VS Code development ecosystem, please do read up on the basics before getting involved:

 1. [Build your own extension](https://code.visualstudio.com/docs/extensions/overview)
 2. [Developing extensions](https://code.visualstudio.com/docs/extensions/developing-extensions)
 3. [VS Code API](https://code.visualstudio.com/docs/extensionAPI/vscode-api)

## Starting up

If you haven't already created a fork of Push, feel free to do so now. You will need a Github account and a recent (8+) version of Node JS & NPM in order to do this.

Once you have the fork and have cloned it to your local development environment, you will then need to run the following command to trigger NPM to install the appropriate required components for Push:

```
npm install
```

Once they are installed, you should be able to then use the debugger/launcher within VS Code to launch and test an instance of Push.

## Contributing changes

There are a few points to be aware of before working on Push:

### 1. Will it make Push better for everyone, or just you?
If the change you are considering may only be useful for yourself, or a small subset of users, the benefit of the change may not be worth the complexity it will add to Push. If you would like to make the change anyway, feel free to, but it may not be accepted as a pull request into Push.

### 2. Has it been tested by at least one user who hasn't had any experience with the new functionality at all?
If you are able to test new functionality on a user who is as yet unfamiliar with it, then please do so. Especially if the functionality has a user experience impact.

### 3. Are any new UI strings translated or at least translateable within the language files?
If you are presenting strings of English text to the user, please do so within the translation framework that Push provides. This is a simple case of:

 1. Add the string to (at minimum) the `src/lang/en_gb.js` file, checking first that an identical string does not exist.
 2. Reference the string by its name using the i18n tools within Push (`i18n#t`, `i18n#o`, etc).

### 4. Have you avoided any new dependencies and if any, checked them for potential node/vscode exploits?
In the event that your change requires new NPM/JS dependencies, please ensure you have checked and reviewed them for potential exploits and/or incompatibilities with VS Code.

### 5. Does the issue you are trying to solve already reported, and if so, have you announced that you will take responsibility for fixing it?
Please check that the problem you are attempting to solve hasn't already been reported, and consider announcing responsibility if you would like to take on the challenge of fixing it.

If you've thought about, and are happy with all of these points, then feel free to continue with the contribution! A brief step-by-step to contributing is as follows:

 1. Fork/clone and `npm install` Push locally.
 2. Create a branch for the feature (`feature/featurename`).
 3. Create, test and review your addition.
 4. Create a pull request from your branch to `push/tree/develop`.

Once it's been reviewed, it can then be merged and will be set for release in the next version.

## If you'd rather not contribute directly

Remember, Push is open source and available under the Apache 2.0 license! You can make a copy if you like, and I won't mind. Should you desire to do so, I would be grateful if you named your version something other than "Push" before submitting it to the VS Code extension marketplace.
