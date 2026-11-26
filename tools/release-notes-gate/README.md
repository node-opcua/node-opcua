# release-notes-gate

A release has notes, and its heading says which release it is.

A note is written in the pull request that makes the change, under an `Unreleased` heading. The
version is chosen when the release is cut, so a heading written in a branch would be a guess. The
release stamps it.

## The two commands

```bash
node tools/release-notes-gate.mjs check            # releasable: Unreleased exists and has a bullet
node tools/release-notes-gate.mjs check --format   # well formed: safe on every pull request
node tools/release-notes-gate.mjs promote          # Unreleased -> Release X.Y.Z, and git add
```

## How it is wired

Into the root package's npm lifecycle scripts, which lerna runs:

| Script | Command | What it does |
| --- | --- | --- |
| `preversion` | `check` | refuses the release while `Unreleased` is missing or empty, before lerna writes anything |
| `version` | `… --stage && … promote` | renames the heading after lerna has written `lerna.json`, and stages the file |

`version` already ran `generate-release-set.mjs --stage`, so the promote is chained after it rather
than replacing it.

The version comes from `lerna.json`, because that is where lerna writes it. The root `package.json`
is not bumped.

lerna runs `version` after it writes `lerna.json` and before it stages its own files and commits, so
the stamped file lands in lerna's own release commit. The existing `version` and `postversion`
scripts are the evidence that this lifecycle fires in this repository.

## The two strictness levels

`check --format` runs on every pull request, so it never asks for content: a CI-only or test-only
change has nothing user-visible to say, and must not be blocked. It checks only that the file is well
formed, that each `=` underline matches its title, and that the first section is `Unreleased` or
`Release X.Y.Z`.

`check` runs before a release. It also requires that `Unreleased` exists and carries at least one
bullet. A release with nothing to say is a defect: either the change was not user-visible, or
somebody forgot the bullet. The gate makes you find out which.

## Promote is idempotent

Running a release twice does not give `Release Release 2.188.0`. When the first section already
names the version being released, promote reports that there is nothing to do and exits 0. When it
names a *different* release, promote refuses, because that means the notes for this release are
missing.

## Tests

```bash
node tools/release-notes-gate/test/test_rule.js
```

29 cases. The ones worth reading first are the two strictness levels: `format` must accept an empty
`Unreleased` section and a file with none at all, and `releasable` must refuse both.
