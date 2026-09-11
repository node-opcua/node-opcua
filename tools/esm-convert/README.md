# esm-convert

Does the mechanical half of converting a package to ESM, and reports the rest.

```bash
node tools/esm-convert.mjs --package node-opcua-transport            # report only
node tools/esm-convert.mjs --package node-opcua-transport --write    # apply
```

Not a gate. It exits 0 either way; it is a helper for FEAT-2.

## What it changes

| | |
|---|---|
| `package.json` | adds `"type": "module"` |
| `.mocharc.js` | renamed to `.mocharc.cjs`, contents untouched |
| `const here = __dirname;` | → `import.meta.dirname`, and drops the note saying it cannot be used yet |
| `module.exports = require("./dist...")` | → `export * from "./dist.../index.js"`, and the same for a `.d.ts` twin that still has no extension on its specifier |

The anchor is only mechanical because FEAT-1 concentrated the scattered uses into one line per
module and `check-dirname` keeps them that way. A tool cannot safely rewrite
`path.join(__dirname, ...)` sprinkled through a file; it can rewrite one known line. That is
what the anchor work bought.

The entry shim is the same story for `.js`: `packageFiles` only ever looked at
`.ts`/`.mts`/`.cts`, so a package whose entry point (no `exports` map, so consumers import
`pkg/nodeJS` or `pkg/testHelpers` directly) is a one-line `module.exports = require(...)` file
was invisible. Once the package is ESM that file is parsed as ESM too. The tool only rewrites
the exact single-statement shape, resolving the specifier to something `export *` can use -
already `.js`, a directory that exists, or a tsconfig outDir (so a `dist*` that has not been
built yet still resolves). A specifier that is not a relative path cannot be resolved with
confidence and is reported instead, under `cjs-entry`.

## What it refuses to change

These alter behaviour rather than syntax, so they are listed and left alone:

| kind | why |
|---|---|
| `require("./thing")` | `import()` is async, so the call site has to become async too |
| `require("../package.json")` | an import attribute, a runtime read, or a build-time constant |
| `require(nonLiteral)` | deliberate, so bundlers skip it |
| `module.exports` | a named or default export, but which is a decision |
| module-scope `await` | breaks `require(esm)` for every CJS consumer downstream |
| `typeof __filename` / `typeof __dirname` | always `"undefined"` under ESM, so the branch that reads the value goes dead |
| `cjs-entry` | an entry shim whose require specifier is not a relative path, so it cannot be resolved with confidence |
| `cjs-module` | a CommonJS `.js` file, elsewhere in the package, that is shipped or referenced by a live file - or is in a `"private": true` package, sits in a test/`bin` tree, or opens with a `#!` shebang, where it is a script or fixture reached some way a static search cannot see |
| `cjs-dead` | a CommonJS `.js` file that is neither shipped nor referenced by anything live, and is not the kind of file a static search could miss - not blocking, but worth deleting before the package flips |

`cjs-dead` means "safe to delete", so it is only emitted when that is provable from static
references: a test fixture reached by a computed path (`testPath("fixtures")`, then spawned as
a child process) or a script meant to be run by hand is `cjs-module` even with zero references,
because "no reference found" does not mean "unused" for either of those. `cjs-dead` does not
count as needing a decision: nothing depends on the file, so it can simply be removed.
Everything else in the table does.

## After it runs

**Rebuild with `--force`.** `tsc -b` does not re-emit on a `type` change alone: its
incremental state does not track that field, so an ordinary build leaves CommonJS output and
looks like it worked. This was found the hard way.

```bash
npx tsc -b packages/<name> --force
cd packages/<name> && npx mocha "test/**/*.ts"
node fixtures/consumer-cjs/index.cjs && node fixtures/consumer-esm/index.mjs
```

## Why the mocha config stays CommonJS

Converting it would work. Mocha 12 loads `.mocharc.js` with `require()`, and on Node >= 22.12
`require()` reads an ES module, so `export default` is picked up: a converted
`node-opcua-transport` ran its 103 tests that way.

It is still the wrong choice. `check-mocharc` mandates the `.cjs` name for a
`"type": "module"` package and renders the canonical contents of every one of these files.
Teaching it a second shape would mean two generators emitting one file and drifting apart, for
a test config that is never published, so there is no ESM purity to gain. The gate stays the
single owner of the content and this tool only renames.

The existing `tsx/cjs` loader in `packages/.mocharc.js` continues to load an ESM package's
TypeScript tests, so no loader change is needed per package.
