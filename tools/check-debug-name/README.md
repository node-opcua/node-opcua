# check-debug-name

The debug logger factories must be given a **stable string literal naming the module**,
never `__filename` or `__dirname`.

```bash
node tools/check-debug-name.mjs                       # report, exit 1 on a violation
node tools/check-debug-name.mjs --fix                 # rewrite, then report what is left
node tools/check-debug-name.mjs --package node-opcua-client
node tools/check-debug-name.mjs --root ../my-project  # any project using these helpers
pnpm run check:debugname                              # same, via the root script
```

## Why

`make_debugLog(__filename)` was the house style, 207 call sites of it. Three things are
wrong with it.

**It does not survive ESM.** `__filename` and `__dirname` do not exist in an ES module or
in a browser bundle. node-opcua is migrating to ESM, so every one of those call sites was
a blocker, and the usual replacement, `import.meta.url`, is a syntax error in CommonJS.
That would have forced the whole tree to flip in one commit.

**The value was never used as a path anyway.** `make_debugLog` and `checkDebugFlag`
immediately reduce their argument with `extractBasename()`, which strips the directory and
a trailing `.js`/`.ts`. What survives is a short name used as a key into `debugFlags` and
matched against the `DEBUG` environment variable. `make_errorLog`, `make_warningLog` and
`make_traceLog` ignore the argument entirely; their displayed filename comes from the call
stack at log time.

**So the literal is strictly better.** `extractBasename` is idempotent on an already-bare
name, which is why passing `"client_session"` needs no change to the helper and keeps
`DEBUG=client_session` selecting exactly the same module as before. There is precedent
already in the tree: `client_transport_base.ts` did this by hand, with the comment *"Use a
string category instead of `__filename` so the module loads in browsers"*.

## What it catches

Flagged and auto-fixable:

```ts
const debugLog = make_debugLog(__filename);   // -> make_debugLog("client_session")
const doDebug = checkDebugFlag(__dirname);    // -> checkDebugFlag("variant_parser")
```

Flagged but never rewritten, because the tool cannot know what the value will be:

```ts
const debugLog = make_debugLog(computeName());
```

Not flagged: a string literal, the factory declarations inside `node-opcua-debug`, and
genuine path uses such as `path.join(__dirname, "../nodesets")`, which are a different
problem.

To opt one line out, say why:

```ts
setDebugFlag(filename, doDebug); // check-debug-name: ok - already a basename
```

## Why regexes here, when check-no-tla uses a parser

`check-no-tla` answers a scope question, which needs a parser: no regex can separate
`if (c) { await x }` from `(async () => { await x })()`.

This tool answers a much narrower question, and unlike that one it **rewrites source**.
Being conservative therefore beats being clever. It matches only the exact shapes
`fn(__filename)`, `fn(__dirname)` and `fn("literal")`, and anything else is reported for a
human rather than guessed at. A parser would let it rewrite expressions it cannot reason
about, which is the wrong risk for a `--fix`. It also keeps the tool dependency-free, so
`--root` can point it at any project that consumes these helpers.

## Layout

`src/rule.js` is pure, so the tests hand it strings and fixture trees rather than shelling
out and matching printed output. `src/index.js` is the command line around it.

```bash
node tools/check-debug-name/test/test_rule.js
```

## Note on `--fix` and the debug key

For `__filename` the rewrite preserves the `DEBUG` key exactly, because the literal is
what `extractBasename` would have produced.

For `__dirname` it does **not**: the key changes from the directory name to the module
name. That only ever affected two call sites, both of which were passing a directory to a
parameter named `scriptFullPath`, and one of which had a debug key of literally
`"source"`. The report names them rather than silently changing them.
