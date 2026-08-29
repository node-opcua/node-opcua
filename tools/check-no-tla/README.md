# check-no-tla

Fails the build if any shipped source file contains **module-scope `await`**.

```bash
node tools/check-no-tla.mjs           # report, exit 1 on any finding
node tools/check-no-tla.mjs --list    # every file scanned
pnpm run check:tla                    # same thing, via the root script
```

## Why this is a gate and not a convention

`node-opcua` is migrating to ESM. The migration only works because Node 22.12 and later
allow `require()` of an ES module, which is what keeps every existing CommonJS consumer
working after the switch. That interop has exactly one disqualifying condition: **a module
graph containing top-level `await` cannot be `require()`d**, and Node throws
`ERR_REQUIRE_ASYNC_MODULE`.

So one `await` added at module scope, anywhere in the graph, turns
`require("node-opcua")` from working into throwing, for everyone. Nothing in the type
checker, the linter or the test suite notices: the suite loads packages with `import`,
where top-level await is legal and works. The failure only shows up in a consumer's
application.

It costs nothing to make that impossible, so it is checked here rather than remembered.

## What counts

Flagged: `await` evaluated when the module body runs, including inside `if`, `try` or a
bare block, and `for await (... )` at module scope.

Not flagged: `await` inside any function scope. Async functions, async class methods,
async object-literal methods, callbacks, and the async-IIFE workaround:

```ts
// legal, and the usual way to keep an eager operation out of the module body
(async () => {
    await main();
})();
```

Scope is decided by parsing with the TypeScript compiler, not by matching text. A regex
cannot tell `if (c) { await x }` from `(async () => { await x })()`, and a false negative
here is silent: it does not fail the build, it breaks `require()` for consumers later.

## What is scanned

`packages/*/source` and `packages/*/src`, for `.ts .tsx .mts .cts .js .mjs .cjs .jsx`.

Declaration files are skipped, as are `node_modules`, `dist`, `dist-esm`, `coverage`,
`build`, and the test trees. Test code is not shipped and is never `require()`d by a
consumer, so top-level await there is free to use.

## Layout

`src/detector.js` is pure and takes source text or a root path, so the tests hand it
strings and fixture trees instead of shelling out and matching printed output.
`src/index.js` is the command line around it.

```bash
node tools/check-no-tla/test/test_detector.js
```

## Fixing a finding

Move the `await` inside an async function, or export something the caller awaits:

```ts
// before: breaks require() for every CJS consumer
export const namespace = await loadNamespace();

// after
export async function getNamespace() {
    return await loadNamespace();
}
```

A lazily-initialised singleton works too, when callers should not care:

```ts
let cached: Namespace | undefined;
export async function getNamespace(): Promise<Namespace> {
    cached ??= await loadNamespace();
    return cached;
}
```
