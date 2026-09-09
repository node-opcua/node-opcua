# check-dirname

Shipped source reaches its own location through one named anchor, not `__dirname` scattered
through the code.

```bash
node tools/check-dirname.mjs
node tools/check-dirname.mjs --package node-opcua-nodesets
```

## The rule

One module-scope anchor is allowed, and encouraged:

```ts
// The one place this module learns where it sits on disk. `import.meta.dirname`
// cannot be used while this package emits CommonJS (TS1470), so the ESM migration
// has this single line to change rather than several scattered uses.
const here = __dirname;
```

Everything else that mentions `__dirname` or `__filename` in code is a finding. A guarded use
(`typeof __filename === "undefined" ? "<browser>" : __filename`) is already ESM-safe and
browser-safe, and is left alone.

## Why

Neither global exists in an ES module, nor in a browser bundle. The point of the anchor is not
style: each module then has exactly one line to change at the flip, and that line is findable.

FEAT-1 converted the real path uses to this shape and asserted the tree was clean. Nothing
gated it. By the time the migration resumed, four raw uses had appeared — two of them in
packages written after FEAT-1 closed. An invariant asserted once and then quietly lost is the
same failure `check-import-extension` had when its scan silently narrowed.

`check-debug-name` covers only `make_debugLog(__filename)`, the logger-factory case. This
covers path resolution, which is the half that actually has to change at the flip.

## Implementation note

Parser-based, not regex-based. `__dirname` appears in comments all over this repository —
including inside the very comment the rule tells you to write — and a regex cannot tell those
from code without reimplementing a tokenizer.

## Scope

Shipped source only, taken from each package's `files` array via
`tools/shared/shipped_dirs.mjs`. Test trees are not scanned: they are not published, and they
keep running under CommonJS until the flip reaches them.
