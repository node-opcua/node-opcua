# check-import-extension

Relative module specifiers must carry the extension ESM will need: `./x.js`, or
`./x/index.js` when the target is a directory.

```bash
node tools/check-import-extension.mjs                       # report, exit 1 on a violation
node tools/check-import-extension.mjs --fix                 # rewrite, then report what is left
node tools/check-import-extension.mjs --package node-opcua-client
node tools/check-import-extension.mjs --root ../my-project
pnpm run check:importext                                    # same, via the root script
```

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
