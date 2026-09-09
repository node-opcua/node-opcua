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

The anchor is only mechanical because FEAT-1 concentrated the scattered uses into one line per
module and `check-dirname` keeps them that way. A tool cannot safely rewrite
`path.join(__dirname, ...)` sprinkled through a file; it can rewrite one known line. That is
what the anchor work bought.

## What it refuses to change

These alter behaviour rather than syntax, so they are listed and left alone:

| kind | why |
|---|---|
| `require("./thing")` | `import()` is async, so the call site has to become async too |
| `require("../package.json")` | an import attribute, a runtime read, or a build-time constant |
| `require(nonLiteral)` | deliberate, so bundlers skip it |
| `module.exports` | a named or default export, but which is a decision |
| module-scope `await` | breaks `require(esm)` for every CJS consumer downstream |

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
