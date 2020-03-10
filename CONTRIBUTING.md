# Contributing

## Installing dependencies

```bash
$ yarn install
```

`npm` doesn't install the correct dependencies for `eslint` so we use `yarn`.

## Regenerating dist/index.js

```bash
$ yarn run package
```

It is recommended to add this as a `git` `pre-commit` hook:

```bash
$ cp pre-commit .git/hooks/pre-commit
```
