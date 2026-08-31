# check-module-identity

A file must reach any one package by a **single route**.

```bash
node tools/check-module-identity.mjs        # report, exit 1 on a violation
pnpm run check:identity                     # same, via the root script
```

## Why

A package can be reached several ways, and they are not the same module instance:

| specifier | resolves to |
|---|---|
| `"node-opcua-foo"` | its `package.json` main, i.e. `dist/index.js` |
| `"node-opcua-foo/dist/x.js"` | the **same** dist tree, same instances |
| `"node-opcua-foo/source/x.js"` | a **second compilation** of the same code |
| `".."` from inside the package | its own dist |
| `"../source/x.js"` from inside it | a second compilation |

Where two routes to one package meet in a running process there are two copies of every
class and every module-scope registry. `instanceof` across the boundary is `false`, and a
resource registered through one copy and disposed through the other is reported as a leak.

## Why it needs a gate rather than review

Neither of the usual checks sees it:

- **`tsc` passes.** The two copies are structurally identical, so assignments type-check.
  It only complains when a *nominal* difference leaks out, and then the error names two
  paths that look the same — which invites "fixing" it by pointing one import at the other
  tree, creating the mix rather than removing it.
- **A single-package test run passes.** One process loading a package twice is usually fine
  in isolation. It surfaces when something else runs alongside it and the timing shifts.

It was found the hard way: a server test imported `Subscription` from `../source` while
`ServerEngine` came from `..`. `tsc` was clean, the package's own suite was clean, and it
failed only when two packages' suites ran concurrently — 35 to 42 leak-detector failures
with no obvious connection to the change.

## What is deliberately not flagged

- **Deep imports into `dist/`** — same tree, same instances.
- **`distNodeJS/` and `distHelpers/`** — sibling entry points that re-export `dist` rather
  than recompiling it (`distNodeJS/generate_address_space.js` does `require("..")`).
- **`import type`**, and a clause of only inline `type` specifiers — erased before anything
  runs, so they cannot duplicate a module.

  They are still worth keeping on the same route, for a different reason: two declarations
  of one class are two *types*, and `tsc` says so. Moving a value import to `dist` while
  leaving a sibling `import type` on `src` produces

  ```
  Types have separate declarations of a private property '_basicDataType'.
  ```

  which is the compiler catching the half-done version of this fix. That failure is loud, so
  it does not need a gate — this rule covers the silent half.
- **Subpath exports** such as `node-opcua-address-space/testHelpers` — they resolve into the
  built tree.

## What this rule does not catch

It checks **one file at a time**, and the hazard is per **process**. Mocha loads a whole
suite into one process, so a package whose tests import `".."` in some files and
`"../source/…"` in others still ends up with two instances, even though no single file
mixes them.

`node-opcua-server` is in that state today: 28 of its test files use `../source`, 6 use
`".."`. It is not obviously wrong — each file is internally consistent, and which tree a
suite exercises is a real choice — so it is left as a judgement call rather than gated. Be
aware of it when a package's tests report leaks that make no sense.

## Fixing a violation

Point the source import at its `dist` equivalent, or import the package by name. Which one
depends on the package's `rootDir`:

| rootDir | `../source/x.js` becomes |
|---|---|
| `""` | `../dist/source/x.js` |
| `"source"` | `../dist/x.js` |

To opt out on one line, with a reason:

```ts
import { thing } from "../source/thing.js"; // check-module-identity: ok - why
```

## Tests

`src/rule.js` is pure and takes source text plus a path, so the tests hand it strings.

```bash
node tools/check-module-identity/test/test_rule.js
```
