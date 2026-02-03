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

## Release team

The current release team is @eregon @MSP-Greg @ntkme @flavorjones @larskanis @headius.
They all have write access to the `setup-ruby` repository, to be able to merge and release `ruby-builder-bot` PRs adding new versions.
The `ruby-builder-bot` PRs are created by [this workflow](https://github.com/ruby/ruby-builder/actions/workflows/check-new-releases.yml) which runs every hour.

The release team can create releases by running [this workflow](https://github.com/ruby/setup-ruby/actions/workflows/release.yml).

The release team and more specifically @larskanis can run [the workflow to check for new RubyInstaller releases](https://github.com/ruby/setup-ruby/actions/workflows/check-new-windows-versions.yml) to speed things up (otherwise it's run twice a day).

The release team must not merge other PRs than the ones from `ruby-builder-bot` (unless they are also setup-ruby maintainers).

## Maintainers

@eregon is the lead maintainer and creator of this action.
Any design change (e.g. new input, different way to do things) must have his approval.

@MSP-Greg @ntkme are maintainers of setup-ruby and should feel free to merge bug fixes, etc.
They should request a review on their PR from another maintainer but they don't have to wait for the review if the fix is urgent (e.g. `setup-ruby` broke in some cases and the fix is obvious).

Naturally maintainers can also [release setup-ruby](https://github.com/ruby/setup-ruby/actions/workflows/release.yml) so the changes from their PR get published.
