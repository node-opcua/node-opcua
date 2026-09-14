# Upgrading to node-opcua 2.184.0: the ESM change

From 2.184.0 every node-opcua package is an ES module. `node-opcua` itself declares
`"type": "module"`, where 2.183.1 declared no `type` at all.

**Your application still runs.** `require("node-opcua")` works unchanged, because Node has
read ES modules from `require()` without a flag since 22.12, and node-opcua has declared a
floor of Node 22.13 since 2.183.0.

**One kind of project stops compiling**: a CommonJS TypeScript project set to
`module: node16`. The fix is one line, and your project stays CommonJS.

- [The short answer](#the-short-answer)
- [If the errors do not go away: delete the build cache](#if-the-errors-do-not-go-away-delete-the-build-cache)
- [What actually breaks, measured](#what-actually-breaks-measured)
- [The three error codes](#the-three-error-codes)
- [Why not convert to ESM instead](#why-not-convert-to-esm-instead)
- [Bundlers: one known break](#bundlers-one-known-break)
- [FAQ](#faq)
- [How much of this is likely to affect you](#how-much-of-this-is-likely-to-affect-you)

## The short answer

If your build reports `TS1479`, `TS1541` or `TS1542` after the upgrade, change two settings
in your `tsconfig.json`:

```jsonc
{
    "compilerOptions": {
        "module": "nodenext",
        "moduleResolution": "nodenext"
    }
}
```

**In a monorepo, look for the shared base config your packages extend rather than editing each
one.** A 22-package workspace needed this change in exactly one file, its `tsconfig.base.json`.
Be aware that editing an extended base is precisely the case TypeScript's incremental cache
fails to invalidate, so read the next section before you conclude anything.

That is the whole migration for most projects. You do **not** add `"type": "module"`, you do
**not** rewrite your imports, and you do **not** switch to `await import()`. TypeScript keeps
emitting CommonJS, and Node loads the ES module through `require()`.

Confirmed on a real consumer rather than a toy: a 145-file package with 19 node-opcua
dependencies went from **258 errors to 0** with those two settings and nothing else changed,
and its full pipeline then ran end to end.

## If the errors do not go away: delete the build cache

**Read this before concluding that the fix above does not work.** It is the single most likely
reason you will think so.

If your project sets `incremental: true`, or `composite: true`, which implies it, and which
every project using project references has, then TypeScript caches diagnostics per file.
Changing `module` in a `tsconfig.json` that your project *extends* does not invalidate that
cache. Old files replay their old errors; only files TypeScript considers changed are checked
under the new setting.

So you apply the fix, recompile, and see the identical error list.

```bash
tsc -b --force          # or delete every .tsbuildinfo and rebuild
```

**The cache is usually not where you look for it.** When `outDir` is set, TypeScript writes
`tsconfig.tsbuildinfo` *inside the output directory*, not next to your `tsconfig.json`. Deleting
the file you expect to find achieves nothing.

Reproduced end to end on a project with `outDir: "out"` and `incremental: true`:

| step | result |
| --- | --- |
| `module: node16` | 1 × `TS1479`, cache written to `out/tsconfig.tsbuildinfo` |
| switch to `nodenext`, delete `./tsconfig.tsbuildinfo` | still 1 × `TS1479` |
| delete `out/tsconfig.tsbuildinfo`, same config, no source change | **0 errors** |

If you are chasing a file that still fails while an identical import in a scratch file next to
it compiles clean, this is why. The scratch file is new, so it is type-checked; the old one is
served from cache.

## What actually breaks, measured

Both versions were installed from npm and driven through the same four projects. Each one was
compiled, and the emitted JavaScript was then executed.

| your project | with 2.183.1 | with 2.184.0 |
| --- | --- | --- |
| plain JavaScript, `require("node-opcua")` | works | **works** |
| TypeScript, `module: commonjs` + `moduleResolution: node` | works | **works** |
| TypeScript, `module: node16` | works | **`TS1479`** |
| TypeScript, `module: nodenext` | works | **works** |

So exactly one shape breaks. Note what does not: plain JavaScript is unaffected, and a
TypeScript project still on the classic `moduleResolution: node` is unaffected, because that
mode ignores both `type` and `exports`.

That last row explains a confusing symptom in a monorepo: some packages break and others do
not, and the difference is their own `module` setting rather than anything about node-opcua.

### The emitted output is still CommonJS

This is the part worth checking yourself, because it is the reason the one-line fix is safe.
With `module: nodenext`, a project with no `type` field compiles to:

```js
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_opcua_1 = require("node-opcua");
```

`require()`, not `import`. Your package stays CommonJS on disk and on npm. `nodenext` is
simply the setting that knows a modern Node can `require()` an ES module; `node16` is the one
that does not.

## The three error codes

One upgrade, three codes, one cause. Measured split in that 145-file package:

| code | where | count |
| --- | --- | --- |
| `TS1479` | value imports | 180 |
| `TS1541` | type-only imports | 76 |
| `TS1542` | | 2 |

**All three are cured by the same one line.**

`TS1541` is a trap worth naming. Its message suggests a per-import `resolution-mode`
attribute, which genuinely works at that one site, so it is possible to spend an afternoon
hand-editing 76 import statements, watching the error count fall, and only then discover that
the 180 `TS1479`s next door cannot be fixed that way at all. A value import of an ES module
from CommonJS is not something an import attribute can authorise. Change the module setting
and all 258 go at once.

## Why not convert to ESM instead

Converting works. It costs much more than one line, and the cost lands on your code rather
than ours.

The moment you set `"type": "module"`, your own project inherits ESM specifier strictness:

- **Every relative import needs an explicit `.js` extension.** Measured at **513 rewrites
  across 107 files** in that one 145-file package.
- **Extensionless subpaths into node-opcua stop resolving.** Specifiers such as
  `node-opcua-address-space/nodeJS` or `node-opcua-data-model/dist/qualified_name` compile
  fine from a CommonJS project under `nodenext`, because these packages publish no `exports`
  map and CommonJS still guesses extensions. From an ESM project they need the extension
  spelled out.
- **`__dirname` and `__filename` stop existing**, and `require()` is no longer in scope.

None of that applies if you stay CommonJS under `nodenext`. Convert when you want to, for
your own reasons, not because this upgrade made you.

### If you do convert: named imports from CommonJS dependencies can fail at run time

This one has no compile-time warning at all, which makes it the most dangerous item on the
conversion path. When an ES module imports a **CommonJS** dependency by name, Node has to
discover that dependency's named exports by reading its source with a static lexer, and the
lexer cannot always follow it:

```ts
import { cyan } from "chalk";   // compiles clean, then throws on first load
```

```
SyntaxError: Named export 'cyan' not found.
The requested module 'chalk' is a CommonJS module...
```

It is **per dependency, not a general rule**, so test rather than rewrite everything. Of five
CommonJS packages imported by name in one real conversion, `chalk` and `showdown` failed while
`closest-match`, `yaml` and `js-yaml` were fine.

The failure happens the first time that module is loaded, which for a rarely-taken code path can
be in production. Default-import-and-destructure always works:

```ts
import chalk from "chalk";
const { cyan } = chalk;
```

## Bundlers: one known break

`tsc` being satisfied does not settle your bundler, and this is the one place where the
`nodenext` fix does not help. It is not a TypeScript question at all: the type-check passes and
the failure happens downstream.

**Most bundlers are fine.** esbuild externalises the whole family from a CommonJS output and
works:

```bash
esbuild src/server.ts --bundle --format=cjs --platform=node --external:node-opcua*
```

The bundle emits `require("node-opcua-...")` for the ESM packages, plain CommonJS loads the
result, and a 658-test suite passes against 2.184.0. esbuild does not adjudicate: you said
external, it emits the `require()`, and Node 22.12+ resolves it.

### Known broken: Next.js 16.2.6 with Turbopack

```
./packages/your-lib/dist/load_yaml/resolvers
Package node-opcua-variant can't be external
The request node-opcua-variant matches serverExternalPackages (or the default list).
The package seems invalid. require() resolves to a EcmaScript module,
which would result in an error in Node.js.
```

The build then reports "Compiled successfully" and dies while collecting page data, with
`TypeError: The "path" argument must be of type string. Received undefined`.

**Read the first line: it names the module doing the importing, not the package being
complained about.** Turbopack is not saying `node-opcua-variant` is invalid. It is saying *this
CommonJS module* would have to `require()` it, and declining to externalise on that basis, even
though Node 22.12+ does exactly that happily. It bundles the package instead, and the build then
fails downstream, because packages get externalised precisely when they use `__dirname` and read
files from disk, which is what nodeset lookup does. Hence the undefined path.

**So the affected shape is narrow**: a **CommonJS** module in the bundle graph importing an
externalised ESM package. Not "any build that externalises node-opcua". Confirmed by changing
one variable: the same Next.js 16.2.6, the same `serverExternalPackages`, the same ESM
node-opcua, and an untouched `next.config.ts` all build clean once the importing package is
itself ESM. The passing build contains zero occurrences of "can't be external".

### What to do about it

1. **Find the CommonJS module named on that first line.** That is the blocker, and it is the
   only thing worth changing.
2. **If you own it, convert that one package to ESM.** In the 22-package workspace this was
   measured in, exactly one package needed it. The other twenty-one took the `nodenext` line.
3. **If it is third-party CommonJS you cannot convert**, `--webpack` is the fallback, but it is
   not a general escape: webpack fails on the same shape with a different message,
   `ESM packages (node-opcua-assert) need to be imported. Use 'import' to reference the package
   instead`.

No node-opcua change can fix this; the conservative check is in the bundler. Whether a newer
Turbopack helps is untested here, and this guide will not name a version: the dev-mode form of
this message was fixed in the Next 14 era, while production-build reports continue against
16.1.x and 16.2.0.

If you are blocked on it, NodeOPCUA Subscription members can reach us through the
[private support channel](https://support.sterfive.com).

## FAQ

**Does `require("node-opcua")` still work?**
Yes, on Node 22.12 and above. Nothing about the runtime changed. node-opcua gates its own
tree against module-scope `await`, which is the one thing that would make `require()` of an
ES module impossible.

**Do I have to convert my project to ESM?**
No. See [the short answer](#the-short-answer).

**Do I have to add `.js` to my imports?**
Only if you convert your own project to ESM. Staying CommonJS under `nodenext` keeps
extensionless relative imports and extensionless node-opcua subpaths working.

**Why did my colleague's package build fine and mine did not?**
Almost certainly a different `module` setting. `node16` breaks; `nodenext`, `commonjs` with
`moduleResolution: node`, and plain JavaScript do not.

**I am on TypeScript 5. Does this apply to me?**
Yes, and the same fix works: `nodenext` under TypeScript 5.9.3 compiles and runs. Support for
`require()` of an ES module under `nodenext` arrived in TypeScript 5.8, so a project on an
earlier 5.x should upgrade TypeScript first.

**Can I just use `moduleResolution: node` and ignore all this?**
It works today and it is not a long-term answer. TypeScript 7 removed that mode outright
(`TS5108`).

**What about `module: node18`?**
It does not help. It reports `TS1479` exactly as `node16` does.

**What Node version do I need?**
22.13 or above, which node-opcua has declared in `engines` on every published package since
2.183.0.

**Why was this not a major version?**
Nothing changed for a running application, and nothing was removed from the API. A CommonJS
TypeScript project needs one setting changed. That is a smaller migration than a major
release implies, and calling it 3.0 would have promised breaking API changes that are not
here.

## How much of this is likely to affect you

In the 22-package workspace where all of this was measured, **twenty-one packages came through
the upgrade on the two tsconfig settings alone**, including a CLI, a language server, an editor
extension, and several back-end services. **One package was converted to ESM**, which was what
unblocked the Next.js application, as described [above](#bundlers-one-known-break).

That migration is complete and green against 2.184.0: two settings in one shared
`tsconfig.base.json`, one package converted, and 6 500 tests passing across the workspace
including the full Next.js build.

If you are stuck on something this guide does not cover, NodeOPCUA Subscription members can
reach us through the [private support channel](https://support.sterfive.com).
