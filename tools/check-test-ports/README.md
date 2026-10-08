# check-test-ports

Finds fixed TCP ports in the test suite, reports collisions, and hands out the next safe one.

```bash
pnpm run check:ports              # report, exit 1 on a collision
pnpm run check:ports:suggest 5    # the next five free, non-stealable ports
node tools/check-test-ports.mjs --list
node tools/check-test-ports.mjs --ai     # a prompt telling a coding agent exactly what to fix
```

## Using it from another repository

It has no dependencies and scans the filesystem, so a consumer needs no build:

```bash
pnpm add -D @sterfive/check-test-ports        # from the registry that hosts it
pnpm exec check-test-ports --summary          # run from the workspace root
```

By default it scans `packages/*/test`, `tests`, `test_long`, `test_helpers`, `test-helpers`,
`test_fixtures` and `test-fixtures`, plus the same under `packages_extra`. To look elsewhere, either
pass flags or add a key to the workspace root `package.json` (flags win):

```json
"checkTestPorts": { "packageRoots": ["packages"], "testDirs": ["test", "tests"] }
```

```bash
check-test-ports --root ../other --package-roots libs --test-dirs spec
```

Numeric separators are read: `30_795` is port 30795.

Publishing is manual and separate from the node-opcua release (lerna covers `packages/*` only).
Bump `version` here, then publish with the registry given on the command line:

```bash
pnpm publish --registry <url-of-your-private-registry> --no-git-checks
```

`access: restricted` is set in `publishConfig`, so a publish that forgets `--registry` asks npmjs
for a private package rather than publishing it openly.

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

### What it reads as a port

- a name starting with `port` or ending with `Port`, in any case (`serverPort`, `TEST_PORT`),
  optionally followed by digits (`case1Port1`, `TEST_PORT_2`);
- declared with `const`/`let`/`var`, or as a class field (`public readonly sourcePort = 2225`,
  `static port = 2225`, `#port = 2225`);
- any other assignment of a literal (`this.port = 2225`, a bare field `port = 2225`) is counted
  and reported as an inline literal;
- a derivation from a declared port (`port + 1`, `TEST_PORT + 1`, `1 + BASE_PORT`) is resolved to
  the port it binds, so it can collide.

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
