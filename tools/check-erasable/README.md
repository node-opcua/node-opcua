# check-erasable

Keeps every test file loadable under Node's own type stripping.

```bash
pnpm run check:erasable                      # report, exit 1 on a violation
node tools/check-erasable.mjs --package node-opcua-server
```

## The problem it prevents

The suite runs on Node's type stripping rather than tsx (`NATIVE_TS` in
`packages/run_all_mocha_tests.js`). Stripping replaces type syntax with whitespace of the
same length and emits nothing, so any construct that has to *produce* JavaScript is refused
at load time:

```
enum E { A = 1 }
$ node --experimental-strip-types a.ts
ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX
```

That is a load failure, not a test failure: the file never runs, and the report says a file
would not load rather than naming the line. Ten test files had to be rewritten to adopt
native stripping. Nothing stopped the eleventh being written the next day.

## What it flags

Five constructs, each verified against `node --experimental-strip-types` rather than read
off a specification:

| construct | write instead |
| --- | --- |
| `enum E { ... }` | a `const` object with `as const`, plus a type alias of the same name |
| `namespace N { ... }` | a module, or a plain exported object |
| `constructor(private x: T)` | a field declaration and an assignment in the constructor body |
| `<T>expr` | `expr as T` |
| `import x = require(...)` / `export = x` | standard `import` / `export default` |

This is **not** TypeScript's `erasableSyntaxOnly`. That flag permits angle-bracket
assertions; Node rejects them. Node is the authority here, so the list came from running
each shape through it.

`declare enum`, `declare namespace`, `declare module "x"` and `as` casts are all erasable
and are not flagged.

## Scope: test trees only

Library source is out of scope, deliberately. The `NATIVE_TS` resolver prefers a package's
compiled output for a relative `.js` specifier and falls back to the `.ts` only when no
`dist` exists, so source arrives as plain JavaScript and is never stripped. There are 264
enum declarations in source today and none of them is a problem; reporting them would force
hundreds of rewrites for no runtime reason.

The fallback does fire on a clean checkout where `build:all` has not run yet. That is a
build-order problem rather than a syntax one, and running `build:all` fixes it.

## Opting out

```ts
enum E { A } // check-erasable: ok - <reason>
```

The line is then exempt, and the file will not load under `NATIVE_TS`. There is no `--fix`:
every remedy is a judgement call about the replacement's shape, and a tool that guessed
would produce worse code than the one it replaced.
