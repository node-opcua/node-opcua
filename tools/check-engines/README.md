# check-engines

Every published package declares the same Node floor as the repository root.

```bash
node tools/check-engines.mjs
node tools/check-engines.mjs --fix     # write the root's floor into every published package
```

## Why

The root has required `node >= 22.13.0` since Node 18 and 20 were dropped from CI in May 2026.
The root is `private: true` and never published, so that declaration reached nobody:

| | declared |
|---|---|
| root (private, unpublished) | `>=22.13.0` |
| `node-opcua`, `node-opcua-address-space`, `-base` | `>=18` |
| the other 110 published packages | nothing at all |

A consumer on Node 18 installed with no warning, against a version CI had stopped testing four
months earlier. Nothing checked, so nothing noticed.

## Why it matters more at 3.0

`require()` of an ES module needs **Node 22.12**. Below that a CJS consumer gets a hard
`ERR_REQUIRE_ESM` at run time, and no `tsconfig` setting can change that — the error comes
from Node's loader, decided by the published `"type": "module"` and the consumer's Node
version.

`engines` is the only standard way to turn that into an install-time signal: a warning by
default, and a refused install for anyone using `engine-strict`.

Worth noting what this means for the ESM migration: **22.12 is below the 22.13 already
required**, so going ESM-only raises the floor for nobody. Anyone it would exclude has been
outside the supported range since May.

## The rule

A published package's `engines.node` must **equal** the root's. Equality rather than "at least
as strict", so there is one floor for the workspace, changed in one place. A package that
genuinely needs a different one is a decision to take deliberately, not to let drift.

Private packages are out of scope: they are never published, so their `engines` reach no
consumer.

## The fixer

`--fix` is text-based, not parse-and-stringify. Reserialising would reformat all 113 manifests
and bury a one-line change in an unreviewable diff. It edits the one value, or inserts the one
block before `dependencies`, and leaves the rest of the file byte-for-byte alone — the sweep
that introduced this gate was 333 insertions and 3 deletions, with nothing outside the
`engines` block touched.

## The cost this accepts

npm emits `EBADENGINE` per offending package, so a user on an unsupported Node sees one warning
per installed node-opcua package rather than one overall. That is noise only for someone
already outside the supported range, and it was judged the right trade for having every
package tell the truth.
