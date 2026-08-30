# check-import-cycles

Fails the build on a circular import that **would throw under ESM**, and stays quiet about
the ones that would not.

```bash
node tools/check-import-cycles.mjs           # report, exit 1 on a dangerous cycle
node tools/check-import-cycles.mjs --all     # list the benign ones too
node tools/check-import-cycles.mjs --package node-opcua-address-space
node tools/check-import-cycles.mjs --root ../my-project
pnpm run check:cycles                        # same, via the root script
```

## Why classify instead of just counting

A cycle is not a defect on its own. Under ESM the bindings are hoisted and live; the
failure mode is a TDZ `ReferenceError`, and that only happens when a module **uses** a
binding from a cyclic partner while its own body is still evaluating. If every use is
inside a function that runs later, the cycle behaves exactly as it does under CommonJS.

Shipped source had **14 cycles and only 3 could break**. A gate that failed on all 14 would
have been noise, and noise gets switched off. So this reports every cycle but fails only on
the ones that matter, and names the exact line that would throw.

## What makes a cycle dangerous

A member uses a cyclic binding at module-evaluation time:

```ts
// a heritage clause runs when the class declaration runs
export class UABaseEventImpl extends UAObjectImpl {}

// so does a module-scope initializer
const _constructors_map = { Method: UAMethodImpl, Object: UAObjectImpl };

// and a module-scope loop
for (const name of Object.keys(StatusCodes)) { ... }
```

All three are real: they are the shapes of the three cycles this repo had to fix before
FEAT-2. Uses inside a function body, including a class *method*, are safe.

## What is an edge

Runtime imports only.

- `import { X } from "./m.js"` and `import X from`, `import * as X from` — an edge
- `export * from "./m.js"` and `export { X } from` — an edge
- `import "./m.js"` — an edge, and an easy one to miss: it has no bindings at all but
  still forces the target to evaluate
- `import type { X } from "./m.js"` — **not** an edge, it is erased
- `import { type X } from "./m.js"` — **not** an edge either, when nothing else in the
  clause survives, because TypeScript elides the whole statement

## Fixing one

Two shapes work, and both were used here:

- **move the shared piece down**, into a module that both sides can depend on.
  `_handle_hierarchy_parent` came out of `namespace_impl` for this reason.
- **invert the dependency and inject**. `status_codes_registry` imports both the generated
  table and the base module, and hands the base module what it needs, rather than the base
  module importing the table back.

Sometimes the import exists for one `instanceof`, in which case a structural test removes
the edge entirely — that is how the eight-file address-space cycle was broken.

If a cycle is genuinely intended, say why on any member file:

```ts
// check-import-cycles: ok - <reason>
```

## Layout

`src/rule.js` is pure and takes a root path, so the tests build small fixture trees rather
than shelling out. Tarjan is iterative: the recursive form overflows the default stack on a
graph this size, and a CI step should not depend on `--stack-size`.

```bash
node tools/check-import-cycles/test/test_rule.js
```
