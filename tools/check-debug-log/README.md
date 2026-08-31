# check-debug-log

Finds — and optionally fixes — debug log calls that are not guarded by a debug flag.

## Why

`make_debugLog()` returns a function that tests the debug flag *inside* itself:

```ts
function debugLogFunc(...args) {
    if (debugFlags[filename] && g_logLevel >= LogLevel.Debug) { ... }
}
```

Arguments are therefore evaluated before the flag is ever consulted. A call like

```ts
debugLog(`subscription ${id} is ${chalk.bgYellow("NORMAL")}`);
```

builds the template string, walks the chalk chain and allocates a rest-args array on
every call, with debugging switched off.

Measured, one such call costs single-digit nanoseconds — this is not a hot-path
emergency. It matters because it is a *latent* hazard: the line is cheap today, and stays
cheap right up until someone adds `.toString()` to it on a per-value path, at which point
the cost appears with nothing in the diff to suggest it. Guarding uniformly removes the
class rather than the instance.

## Usage

```bash
node tools/check-debug-log.mjs                      # report; exits 1 if anything is unguarded
node tools/check-debug-log.mjs --verbose            # list every site as file:line
node tools/check-debug-log.mjs --fix                # rewrite them
node tools/check-debug-log.mjs --package node-opcua-server
```

From the repo root:

```bash
pnpm run check:debuglog
pnpm run check:debuglog:fix
```

`--fix` produces the two conventions already used across the repo, picking whichever fits.
A lone call is guarded inline, because an `if` block would spend three lines protecting
one — and across this repo 93% of sites are lone calls:

```ts
// c8 ignore next
doDebug && debugLog(`Cannot find constructor for ${nodeId.toString()}`);
```

Consecutive calls share a single block instead of repeating the guard per line:

```ts
// c8 ignore next
if (doDebug) {
    debugLog("current value =>", this.oldDataValue?.toString());
    debugLog("proposed value =>", dataValue?.toString());
}
```

If a file has no debug flag it declares one next to the logger, adding `checkDebugFlag` to
the existing `node-opcua-debug` import. A file whose flag is parked as an unused
`_doDebug` has it promoted rather than duplicated.

Run the formatter afterwards: the rewrite indents but does not re-wrap long lines.

```bash
npx biome check --write --no-errors-on-unmatched packages
```

## As a quality gate

The no-argument form exits non-zero when anything is unguarded, so it drops into CI or a
pre-commit hook directly. Scope it to a package while a backlog is being worked down:

```bash
node tools/check-debug-log.mjs --package node-opcua-server
```

## Limitations

The analysis is lexical, not a real parse — it has to run as a gate without a build step.
It only rewrites statements that begin with a logger call; anything else (a call inside a
ternary, or one whose arguments contain braces in a string literal) is reported and left
alone, because guessing the statement's extent wrong would emit code that does not
compile. Both modes are idempotent.
