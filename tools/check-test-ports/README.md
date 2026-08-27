# check-test-ports

Finds fixed TCP ports in the test suite, reports collisions, and hands out the next safe one.

```bash
pnpm run check:ports              # report, exit 1 on a collision
pnpm run check:ports:suggest 5    # the next five free, non-stealable ports
node tools/check-test-ports.mjs --list
node tools/check-test-ports.mjs --ai     # a prompt telling a coding agent exactly what to fix
```

## The convention

```js
const port = 5741;            // once, at the top of the file
...
await startServer({ port });  // everywhere else refers to the constant
```

That rule is what keeps the scanner simple. A port written straight into an options
object propagates transitively through calls and modules, and following it would mean
resolving variables across files. Forbidding it instead means the declarations are a
complete picture, and a reader finds a file's port by looking at the top of it.

## What it reports

| kind | meaning | fails build |
|---|---|---|
| collision | one port claimed by two files — an `EADDRINUSE` waiting for a busy machine | **yes** |
| ephemeral | a fixed port at or above 32768, stealable by any `listen(0)` | warn |
| inline literal | a port written outside a declaration | warn |
| port 0 | the OS chooses, so a failure names a port nobody can trace | warn |

Only a collision fails: it is unambiguous and one side simply has to move. The other three
describe bodies of existing tests that need migrating, and failing on them would mean
nobody can add a test until that migration is finished.

## Why it exists

The suite binds fixed ports on purpose — a deterministic port makes a failure
attributable, where an ephemeral one turns a collision into a ghost. That only holds while
no two files pick the same number, and the runner executes files concurrently.

It was written after an `EADDRINUSE` took master red. It cleared the transport package of
suspicion (5678, 5878 and 5893 each have exactly one claimant, so that failure was a file
colliding with itself) and found two genuine collisions elsewhere that nobody had hit yet.

## Tests

```bash
node tools/check-test-ports/test/test_scanner.js
```

The fixtures reproduce every pattern found in the real suite, including the ones that must
*not* match: `transportTimeout`, `supportedVersion`, `reportInterval` and `exportCount` all
contain "port", and an early version of the scanner flagged `transportTimeout`.
