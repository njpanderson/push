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

## Contributing language files

Language files are a combination of ISO 639-1 language codes and ISO 3166-1 Alpha-2 codes of country codes. Country code is optional if a language does not require that definition, e.g. 'ja' (Japanese) vs 'en_gb' (British English).

The following steps will get you started translating Push:

1. Create a local fork of Push and clone it.
2. Set it up for development within VS Code, using the instructions above.
3. Duplicate `src/lang/en_gb.js` to `src/lang/your-language-code.js` (using the reference from ISO 639-1/ISO 3166-1) and make text changes as needed.
4. Test using the vs code debugger "Launch extension" launch config.
5. Open a project or workspace in the test window, then set your Push preferences `njpPush.locale` to `fr`. Anything that can be localised should now be using your `fr.js` for strings.

There are replacement variables throughout the strings which are replaced with real values during runtime:

 - `${1-9}`: Reference numbered arguments within `i18n.t`, etc
 - `p{1-9:(singular):(plural)}`: Is a pluralise replacement. If the `1-9` argument is `1`, the `(singular)` is used, otherwise the `(plural)` is used.

**Things to note**

 - The language is of course quite technical. Keep this in mind when translating to native terms.
 - "Push" should remain verbatim. It's a brand, and should be recognisable in any language.
 - Try to be consistent with the existing letter casing. If a string is in title case, keep it in title case — unless the language itself overrides this requirement (such as languages with no uppercase letters).
 - Try to maintain any punctuation defined, such as parentheses, full stops, commas etc.
 - Most of the strings support flexible lengths, but try not to exceed the length of any string to an extreme degree. If the native terms feel too long compared to the english version, consider truncating them.

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

## Creating a development environment

If you've thought about, and are happy with all of these points, then feel free to continue with the contribution! A brief step-by-step to contributing is as follows:

 1. Fork/clone and `npm install` Push locally.
 2. Create a branch for the feature (`feature/featurename`).
 3. Create, test and review your addition.
 4. Create a pull request from your branch to `push/tree/develop`.

Once it's been reviewed, it can then be merged and will be set for release in the next version.

## If you'd rather not contribute directly

Remember, Push is open source and available under the Apache 2.0 license! You can make a copy if you like, and I won't mind. Should you desire to do so, I would be grateful if you named your version something other than "Push" before submitting it to the VS Code extension marketplace.
