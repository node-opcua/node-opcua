# check-cjs-globals

A CommonJS-only global (`require`, `module`, `exports`) used as a value in a file that is
an ES module.

```bash
node tools/check-cjs-globals.mjs
node tools/check-cjs-globals.mjs --package node-opcua-client
node tools/check-cjs-globals.mjs --scope tests
node tools/check-cjs-globals.mjs --fix
```

## Why

All 122 packages in this workspace declare `"type": "module"`. A `.ts` or `.js` file
inside one of them is an ES module, where `require`, `module` and `exports` simply do not
exist. Two files still contained `if (require.main === module)`, the CommonJS "was I run
directly?" idiom. That failed at *import* time, not when the branch ran, so a test
importing one of those files for its exports crashed on the reference alone. Nothing
caught it until the test loader moved to real ESM (FEAT-4), and even then only the
`build_per_package` CI job saw it.

## The rule

Flags a use, as a value, of:

- `require` (including `require.main`)
- `module` (including `module.exports`, `module.parent`, `module.id`)
- `exports`

Does **not** flag:

- `.cjs` and `.mjs` files: their extension already settles the module format, and `.cjs`
  is legitimately CommonJS. Neither is scanned at all.
- a file whose nearest `package.json` says `"type": "commonjs"`, resolved by walking
  upward from the file, not assumed from the package root - a nested manifest (a
  generated folder, say) can override it.
- a `require` bound locally in the same file by `createRequire(import.meta.url)`. That is
  the deliberate synchronous-require form this repo uses on purpose
  (`node-opcua-leak-detector/src/mem_leak_detector.js`, `client-dynamic-extension-object`,
  `vendor-diagnostic`), and `tools/esm-convert` writes it itself.
- an identifier in a type position, or a local variable/parameter that merely happens to
  be named `module` or `exports`. The check resolves the identifier through the file's
  scopes (parameters, `var`/`let`/`const`, `catch`, imports) rather than assuming every
  occurrence of the name is the global.
- `__dirname` / `__filename`: those belong to `check-dirname`, not duplicated here.
- a line carrying `// check-cjs-globals: ok - why`.

Parser-based, not regex-based, for the same reason `check-dirname` is: these are common
English/JS words that appear in comments and strings throughout the repository, and
`createRequire`-bound locals and named parameters need real scope resolution, not a
pattern match.

## `--fix`

Rewrites only this exact idiom, and its reversed spelling:

```ts
if (require.main === module) {
```

```ts
if (module === require.main) {
```

become:

```ts
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
```

with `import { pathToFileURL } from "node:url";` added beside the file's other `node:`
imports if it is not already there. Everything else is reported and left alone: the tool
refuses rather than guesses, the stated philosophy of `esm-convert`.

## Scope

`--scope source` (shipped source, from each package's `files` array via
`tools/shared/shipped_dirs.mjs`), `--scope tests` (`tools/shared/test_dirs.mjs`), or
`--scope all` (both, the default). A test file is not published, but it is still a
module inside a `"type": "module"` package and breaks on import exactly the same way.
