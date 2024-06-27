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

## Adding a new Ruby version

This is entirely automated now since [this issue](https://github.com/ruby/setup-ruby/issues/254).
If you do not see a new version more than 24 hours after it was released feel free to file an issue.

## Release

Maintainers can create a release automatically by running [this workflow](https://github.com/ruby/setup-ruby/actions/workflows/release.yml).
