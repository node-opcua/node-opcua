# check-pack

Every entry point a package declares must actually be in the tarball npm would publish.

```bash
node tools/check-pack.mjs                      # report, exit 1 on a violation
node tools/check-pack.mjs --package node-opcua
pnpm run check:pack                            # same, via the root script
```

## Why

The consumer fixtures in `fixtures/` load `node-opcua` through a **pnpm workspace
symlink**, which resolves against the working tree. That catches a wrong `exports`
condition or a named export `cjs-module-lexer` failed to find. It cannot catch a
*packaging* fault: a `main`, `types` or `exports` target that `files` or `.npmignore`
leaves out of the published tarball. The symlink sees the whole working tree, so
everything resolves whether or not it would ship.

Nothing in CI looked at what npm would actually publish, so that class of bug could only
be discovered by publishing it.

This matters more from here on. FEAT-3 of the ESM migration adds real `exports` maps to
116 packages, and an `exports` map is a promise about files that exist. A map naming a
path that is not shipped resolves fine for every developer and fails for every consumer.

## What it checks

For each publishable package (anything without `"private": true`), it asks npm what it
would ship, with `npm pack --dry-run --json --ignore-scripts`, and then verifies that
every path named by:

- `main`, `types`, `typings`, `module`
- `browser`, as a string or a mapping
- every string leaf of `exports`, at any nesting depth

is present in that file list.

A bare specifier inside `exports` (`"./polyfill": "node-opcua-utils/polyfill"`) is a
redirect to another package, not a file in this tarball, so it is skipped.

A package that cannot be packed at all is reported as a failure rather than passing
quietly.

## Cost

This one is slower than the other checks, because it invokes npm once per publishable
package. It runs as its own CI job rather than inside `lint`.

## Layout

The npm call is at the edge (`packFileList`), and `analyze` takes it as an injectable
`pack` argument, so the interesting logic is pure and the tests hand it fabricated file
lists instead of packing anything.

```bash
node tools/check-pack/test/test_rule.js
```
