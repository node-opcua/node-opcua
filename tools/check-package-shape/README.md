# check-package-shape

`publint` and `attw` on every publishable package: is the manifest coherent, and does a consumer
actually resolve what it promises?

## Why, and how it differs from the neighbours

Three rules now look at packaging, and they ask different questions:

| rule | question |
| --- | --- |
| `check-build-graph` | is the package compiled at all? |
| `check-pack` | is every declared entry point in the tarball? |
| this one | is the manifest coherent, and do a consumer's imports resolve? |

`check-pack` proves a promised file exists. It cannot tell you the promise is wrong: an `exports`
map with its conditions in the wrong order, a `bin` without a shebang (which simply fails to
execute on Linux), a file extension that contradicts `type`, or declarations a consumer's
TypeScript resolves to something unusable. publint reads the packed manifest; attw resolves the
package as both an ESM and a CommonJS consumer.

It earned its place before it was written: a trial run found `node-opcua-nodeset-i-4-aas` shipping
no `dist` and `node-opcua-leak-detector` shipping no types, both fixed in #1695.

## The esm-only profile

attw runs with `--profile esm-only`, which ignores the `node10` and `node16-cjs` resolutions. That
is a decision, not a convenience. The workspace is moving to ESM, `require(esm)` works from
Node 22.12, and the declared floor is 22.13. Without the profile every ESM package reports
`node16 (from CJS): ESM (dynamic import only)` and the gate would be permanently red for something
deliberate.

## The ratchet

Packages already failing are listed in `tools/package-shape-baseline.json`. A package that is green,
or new, must stay green. When you repair a baselined package, remove it from the baseline:

```bash
pnpm run check:shape            # report, exit 1 on a new failure
pnpm run check:shape:update     # rewrite the baseline
node tools/check-package-shape.mjs --package node-opcua-client
node tools/check-package-shape.mjs --concurrency 8
```

Never commit an `--update` that *adds* a package. The list only shrinks.

Run it on a **fresh** build. A dist left over from before a package was flipped to ESM makes attw
report `unexpected module syntax` for it, because the files on disk were compiled as CommonJS while
the manifest now says `type: module`. That looks exactly like a real regression; `pnpm run
build:all` on a cleaned tree tells the two apart.

### What is in the baseline today, and why

The baseline started at six and is down to one, without anybody working on those entries:
`node-opcua`, `node-opcua-client`, `node-opcua-modeler` and `node-opcua-secure-channel` were here
for attw's *named exports* problem and left when FEAT-2 batches 5 and 6 made them real ESM;
`node-opcua-client-browser` left with batch 7. That is the ratchet working as intended. One remains:

- `node-opcua-samples`: attw's *resolution failed*. The package is a set of command line samples:
  it declares `bin` entries and no `main`, `types` or `exports` at all, so importing it resolves to
  nothing. attw is right that the `.d.ts` files in its tarball (a by-product of compiling
  `bin/*.ts` into `dist`) are unreachable, but there is no API here for anyone to import. Compare
  `node-opcua-local-discovery-server`, also command line only, which attw passes precisely because
  it ships no declarations at all. Closing this means either declaring an entry point or not
  publishing the declarations, rather than a fix to the manifest.

## Cost

Both tools pack the package, so this is slower than the lint rules, around 12 seconds per package
before concurrency. It runs in the `build_per_package` CI job, which already has a built workspace
and does per-package work, rather than inside `lint:ci`.
