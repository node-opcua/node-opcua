# check-mocharc

Keeps every package's mocha configuration on one shape that survives pnpm's layout.

```bash
pnpm run check:mocharc          # report, exit 1 if anything is off-pattern
pnpm run check:mocharc:fix      # rewrite to the canonical shape
node tools/check-mocharc.mjs --verbose
```

## The problem it prevents

Mocha does not merge configuration files. The nearest `.mocharc` wins outright, so a
package that wants a single setting changed — almost always `timeout` — has to restate
the loader list too. This repo had 52 hand-maintained configs, 24 of them carrying a
loader as a relative path:

```yaml
require:
  - ../../node_modules/should
```

Mocha resolves those from **its own install directory**, not the working directory. So
whether one works depends on how deep the package happens to sit. The identical mistake
one level up — `../node_modules/source-map-support/register` in `packages/.mocharc.yml` —
expanded to `mocha/lib/node_modules/source-map-support/register`, and every package
without a config of its own failed to start with `ERR_MODULE_NOT_FOUND`. The deeper
copies kept working by accident, which is why it went unnoticed: CI runs
`run_all_mocha_tests.js` and `parallel_test.js`, both of which build their Mocha instance
in code and never read a `.mocharc` at all.

## The shape it enforces

```js
module.exports = {
    ...require("../.mocharc.js"),
    timeout: 20000
};
```

- Loaders are declared **once**, in `packages/.mocharc.js`, via `require.resolve` —
  absolute paths, immune to depth and to pnpm's layout.
- A package lists only what it changes.
- A package that changes nothing carries no config file at all.
- A package declaring `"type": "module"` uses `.mocharc.cjs`; the config is CommonJS
  wherever it lives, and a `.mocharc.js` in an ESM package dies on
  `module is not defined in ES module scope`.

## What it reports

| kind | meaning |
|---|---|
| `drift` | on the pattern but not in canonical text — `--fix` rewrites it |
| `redundant` | overrides nothing; `--fix` deletes it |
| `own-require` | redeclares `require`, discarding the resolved paths — the original bug |
| `no-spread` | does not spread the baseline, so it silently loses the loaders |
| `unloadable` | throws when required, usually the ESM/CJS mismatch above |
| `foreign` | a `.yml`/`.json`/… config; convert by hand, the tool will not parse YAML |

`foreign` is deliberately not auto-fixed: converting YAML would mean taking on a parser
dependency for a migration that happens once.
