# check-published

Every package version of the working tree must be on the registry.

```bash
node tools/check-published.mjs                                         # exit 0 all there, 1 missing, 2 no answer
node tools/check-published.mjs --include-private node-opcua-versions   # also a private package that a pass lifts
pnpm run check:published                                               # same, via the root script
```

## Why

The publish workflow runs `lerna publish from-package` with provenance. The transparency
log (Rekor) can store a provenance entry and answer too late; npm then uploads it again and
gets `409 an equivalent entry already exists` (`TLOG_CREATE_ENTRY_ERROR`). By then npm has
already accepted the package, but lerna reports it as failed and stops the whole pass. The
workflow retries, and a retry can stop on the next such answer. A release can be complete
on the registry while every attempt ends in an error.

So after a failed attempt the workflow asks the registry. When every `name@version` of the
tree is there, the step passes with a warning; otherwise the retry loop goes on as before.

## What it checks

For each publishable package (`"private"` not true), and each private package named with
`--include-private`, it asks the registry for `<registry>/<name>/<version>`: 200 is present,
404 is absent, any other answer is a failure (exit 2, never a pass). A package that the
release did not bump keeps its older version in its manifest, which is already published, so
it counts as present.

The registry call uses `fetch` and runs a few queries at a time. `--registry` changes the
registry (default `https://registry.npmjs.org`).

## Layout

The registry call is at the edge (`registryHas`), and `analyze` takes it as an argument, so the
tests hand it a fabricated registry and need no network.

```bash
node tools/check-published/test/test_rule.js
```
