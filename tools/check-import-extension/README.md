# check-import-extension

Relative module specifiers must carry the extension ESM will need: `./x.js`, or
`./x/index.js` when the target is a directory.

```bash
node tools/check-import-extension.mjs                       # report, exit 1 on a violation
node tools/check-import-extension.mjs --fix                 # rewrite, then report what is left
node tools/check-import-extension.mjs --package node-opcua-client
node tools/check-import-extension.mjs --root ../my-project
node tools/check-import-extension.mjs --scope source        # published source only
node tools/check-import-extension.mjs --scope tests         # test trees only
pnpm run check:importext                                    # same, via the root script
```

## Scope

The default covers **both** `source`/`src` and the test trees
(`test`, `test_helpers`, `test_fixtures`). Narrow it with `--scope`.

A test tree is not published, but that does not exempt it: a `.ts` or `.js` file inside a
`"type": "module"` package **is** an ES module whether it ships or not. A package that flips
with an extensionless specifier in its own suite breaks its own tests, and would do so at
the least convenient moment.

The report always names the scope it covered. A bare count reads as if it had covered
everything, which is exactly the mistake this tool made while it silently scanned
`source`/`src` alone.

## What `--fix` cannot do: `.`, `..`, `../..`

A specifier made only of traversal names a *directory* and carries no filename, so it
resolves only through that directory's `package.json` - a resolution NodeNext does not
perform for a relative specifier. There is no extension to add.

They fail the gate. While 333 of them stood in the tree they were reported without failing,
because a gate that can never go green is not a gate; they are all gone now.

`--fix` still leaves them alone, because the replacement is not derivable from the specifier:
it is whatever entry point the target package already names. Take that from `types`, with the
`.d.ts` swapped for `.js`, and fall back to `main`.

`types` first, not `main`, because these callers are TypeScript and `types` is the surface
they are type-checked against. Most packages point both fields at one file and the choice does
not arise. `node-opcua-address-space` did not, and its 158 call sites had to wait: `main` named
`dist/src/index_current.js` and `types` named `dist/source/index.d.ts`, two modules exporting
two different `AddressSpace` classes. Naming one type-checked and then failed at run time,
naming the other kept the run time and produced 545 type errors.

That is fixed, the 158 are converted, and `PACKAGE_ROOT_BLOCKED` is empty. `check-entry-points`
now fails any package whose `types` and `main` name different modules, so the situation that
required the exemption cannot recur unnoticed.

Reaching for `../source/index.js` instead would be a different mistake: that is a second
compilation of the package, and `check-module-identity` exists because of what happens next.

## Why

ESM has **no extension search and no directory resolution**. `import "./foo"` fails where
CommonJS would have found `foo.js`, and `import "./foo"` for a directory fails where
CommonJS would have found `foo/index.js`.

TypeScript's `NodeNext` accepts the extensionless form while a package emits CommonJS and
rejects it the moment that package becomes `"type": "module"`. That is why ~4900 of them
accumulated, and why they can all be written now, before anything flips: CommonJS tolerates
both forms. Nine CommonJS packages in this repo already carried explicit `.js` specifiers
and built green long before this tool existed.

Doing it early means the ESM flip is a change of `type` and little else, rather than a
change of `type` plus five thousand edits made under pressure.

## The distinction that matters

A naive fixer appends `.js` to everything and breaks every directory import. This one
resolves each specifier against the filesystem:

| on disk | specifier becomes |
|---|---|
| `./x.ts` exists | `./x.js` |
| `./x/index.ts` exists | `./x/index.js` |
| neither | reported, never rewritten |

A file wins over a same-named directory, matching Node.

## Why a parser here, when check-debug-name uses regexes

Both tools rewrite source, so both are conservative, but the risk differs.

A module specifier is a string, and this repo contains **code generators whose output is
TypeScript containing import statements**. So `from "./${filename}"` genuinely appears
inside template literals, and `// import { X } from "./BaseNode";` appears inside comments.
A regex cannot tell those from a real `ImportDeclaration`. With ~4900 rewrites, a single
false positive would silently corrupt generator output or edit a comment.

Measured, not assumed: a regex-based first pass reported 7 specifiers it could not resolve.
All 7 were false positives, 3 inside template literals and 4 inside comments. The
parser-based tool reports **zero**.

## What it covers

`import`, `import type`, `export ... from`, `export * from`, and dynamic `import()`.
Type-only imports are included so the tree stays uniform, even though they are erased
before runtime.

Left alone: bare package specifiers (`node-opcua-utils`, `node:path`), and anything already
ending `.js .mjs .cjs .json .node .css`.

To opt one line out, say why:

```ts
import x from "./special"; // check-import-extension: ok - resolved by a bundler alias
```

## Layout

`src/rule.js` is pure and takes source text plus a path, so the tests hand it strings and
fixture trees rather than shelling out.

```bash
node tools/check-import-extension/test/test_rule.js
```
