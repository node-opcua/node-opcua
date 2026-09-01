# check-entry-points

A package's `types` must describe the module its `main` loads, and the implementation it
publishes must say that it is implementation.

```bash
node tools/check-entry-points.mjs                    # report, exit 1 on a violation
node tools/check-entry-points.mjs --package node-opcua-client
node tools/check-entry-points.mjs --update           # rewrite the baseline
pnpm run check:entrypoints                           # same, via the root script
```

## Why

`node-opcua-address-space` declared:

```json
"main":  "./dist/src/index_current.js",
"types": "./dist/source/index.d.ts"
```

Two modules, two lists of names, nothing keeping them in step. They drifted:

- **12 names the .d.ts promised that `main` did not export.** `import { CloneHelper } from
  "node-opcua"` type-checked and was `undefined` at run time. The umbrella re-exports that
  package, so every consumer of the published API carried it.
- **52 names `main` exported that the .d.ts never mentioned**, so no TypeScript consumer
  could import them at all.

Neither is visible to the compiler, to the test suite, or to review. Both are mechanical to
check, which is what this does.

## The two checks

**entry** - `types` names the declarations beside the file `main` names, which is what tsc
emits. Absolute: no package may split them, and none does. A missing field is reported as
`no-types`/`no-main` rather than as a split.

**internal** - an exported symbol shaped like implementation (`*Impl`, `*ImplBase`, a leading
underscore) carries an `@internal` tag, so typedoc's `excludeInternal` keeps it out of the
published documentation.

## Only what is published

The tag check considers a symbol only if the package's **entry** actually exposes it. A
package exports its implementation classes between its own modules constantly - `BaseNodeImpl`,
`UAVariableImpl`, `_clone` - and typedoc never sees those, because it only follows the entry
point.

Scoping matters more than it sounds: unscoped, this rule reported 115 symbols, of which 70
could not reach the documentation by any route. A gate that reports on what it does not guard
teaches people to ignore it.

Reachability is computed by walking the entry's export statements, so it needs no build.
`export * from "./x.js"` pulls in everything `x` publishes, recursively; `export { a } from
"./x.js"` pulls in `a` and nothing else from that module.

## The baseline

The entry check is absolute. The tag check is a ratchet, in the shape of
`private-key-usage-baseline.json`: `tools/entry-points-baseline.json` holds a count per
package, a package may lower its number but never raise it, and `--update` rewrites the file
after a legitimate removal.

45 predate the rule, across 10 packages. 32 of them are `_enumeration*` in
`node-opcua-types`' generated `_generated_opcua_types.ts`, so clearing those means changing
the generator rather than the file.

`node-opcua-address-space` is not in the baseline: its 36 were tagged when this rule was
written.

## Opting out

```ts
// check-entry-points: ok - kept exported for one release, removed at 3.0
export class LegacyImpl {}
```
