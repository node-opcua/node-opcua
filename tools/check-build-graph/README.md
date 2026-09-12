# check-build-graph

Every publishable package must be reachable in the TypeScript build graph, so that it is actually
compiled.

## Why

`pnpm run build` is `tsc -b packages`. That builds the projects `packages/tsconfig.json`
references, and transitively the projects those reference. The aggregate list is maintained by
hand: `fix-tsconfigs` rewrites each package's own references from its dependencies, but nothing
writes the aggregate.

So a package can exist, compile fine on its own, be published, and never be built. That happened.
`node-opcua-nodeset-i-4-aas` was absent from the aggregate list and nothing else referenced it, so
`tsc -b packages` skipped it and `files: ["dist", "source"]` shipped only the half that existed:
version 2.183.1 went to npm as `LICENSE`, `package.json` and 44 `source/*.ts` files, with `main`
naming a `dist/index.js` that was not in the tarball. Every consumer of the I4AAS companion
nodeset failed to resolve it.

`check-pack` now catches that shape one step before publish, by comparing declared entry points
against the real tarball. This rule catches the cause instead: the package is never compiled. It
only reads files, so it runs inside `lint:ci` rather than as its own CI job.

## What counts

- **Reachable** means: named in `packages/tsconfig.json`, or referenced by something that is,
  transitively. A leaf package pulled in only through a dependant's references is fine, which is
  how most of the workspace is built (73 aggregate entries reach 121 packages).
- **Publishable** means `private` is not `true`. A private package that never builds breaks nobody
  outside the repo; `playground` sits outside the graph deliberately.
- A package with no `tsconfig.json` is not in scope.

## Running it

```bash
pnpm run check:buildgraph
node tools/check-build-graph.mjs --root ../another-workspace
node tools/check-build-graph/test/test_rule.js
```

## Fixing a violation

Add the package to `references` in `packages/tsconfig.json`, or, when a package genuinely depends
on it, add the reference there and let the closure pull it in. If the package is not meant to ship,
mark it `private: true` instead.

## Note on parsing

tsconfigs here are JSONC, not JSON: 31 generated nodeset files end an array with a trailing comma,
`node-opcua-modeler` carries comments, and `node-opcua-debug` carries a UTF-8 BOM. The reader
strips all three. Comment stripping is string-aware on purpose, because an include glob such as
`source/**/*.ts` contains a `/*` that a regex would treat as the start of a comment.
