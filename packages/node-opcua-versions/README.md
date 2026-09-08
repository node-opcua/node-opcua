# node-opcua-versions

Keep the `node-opcua-*` dependencies of a `package.json`, or of a whole workspace, on one
coherent node-opcua release.

```bash
npx node-opcua-versions@latest bump            # move every node-opcua-* dependency to the newest release
npx node-opcua-versions@2.185.0 bump           # ... to release 2.185.0 exactly, up or down: the tool's version is the release
npx node-opcua-versions@latest expand          # declare the node-opcua-* peers your @sterfive/* packages need
npx node-opcua-versions@latest check           # is every node-opcua-* pin part of one release? (exit 1 if not)
npx node-opcua-versions@latest bump -w         # the same, for the root and every package of a monorepo
npx node-opcua-versions@latest                 # this help
```

- [Commands](#commands)
  - [bump](#bump)
  - [expand](#expand)
  - [check](#check)
  - [show and releases](#show-and-releases)
  - [Workspaces: `-w`](#workspaces--w)
  - [Independent packages: `--all`](#independent-packages---all)
  - [Peer dependencies of a library](#peer-dependencies-of-a-library)
  - [Common options](#common-options)
- [Why: a release is a set, not a number](#why-a-release-is-a-set-not-a-number)
- [Where the matrix lives: the registry is the history](#where-the-matrix-lives-the-registry-is-the-history)
- [Use from code](#use-from-code)
- [In CI and git hooks](#in-ci-and-git-hooks)
- [Relationship with other tools](#relationship-with-other-tools)
- [FAQ](#faq)
- [For node-opcua maintainers](#for-node-opcua-maintainers)

## Commands

Run the commands with `npx node-opcua-versions@<release> ...`. **The version of the tool
is the release it targets**: `@latest` is the newest node-opcua release, `@2.185.0` is
release 2.185.0, and that works downwards as well as upwards, so a rollback to a known-good
release is the same command as an upgrade. There is no need to install the package
globally, and a good reason not to: a global copy is one fixed release; when a newer one
is published, `bump` says so and tells you to run `@latest`.

The floor is the release that introduced the tool: an earlier release has no
`node-opcua-versions@<release>` on the registry and is refused with a message saying so
(its manifests are only in the repository's git tags).

### bump

```bash
npx node-opcua-versions@<release> bump [--release <version> | --latest] [--dry-run] [--install] [--include-peers] [-w | -a]
```

Rewrites every `node-opcua-*` dependency found in `dependencies` and `devDependencies`
to the version it has in a release. Which release:

| invocation | target |
| --- | --- |
| `npx node-opcua-versions@latest bump` | the newest published release |
| `npx node-opcua-versions@2.185.0 bump` | release 2.185.0, whether that is up or down from where you are |
| `... bump --release 2.185.0` | release 2.185.0, from any copy of the tool (read from the registry) |
| `... bump --latest` | the newest published release, from any copy of the tool |

Without `--release` or `--latest`, `bump` targets the release the running copy was
published with, and, when the registry has a newer one, prints a note saying which and
how to get there. Packages the release does not know are left alone. Exact pins are
written.

```text
$ npx node-opcua-versions@latest bump --dry-run
release 2.181.1 (2026-09-05)
  node-opcua                                          2.179.0  ->  2.181.1   (dependencies)
  node-opcua-address-space                            2.179.0  ->  2.181.1   (dependencies)
  node-opcua-pseudo-session                           2.179.0  ->  2.181.1   (dependencies)
  node-opcua-crypto                                     5.9.0  ->  5.10.1   (dependencies)
```

- `--dry-run` prints the plan and writes nothing.
- `--install` runs the package manager's install afterwards so that the lockfile follows
  the manifests: `pnpm-lock.yaml` → `pnpm install`, `yarn.lock` → `yarn install`,
  `package-lock.json` → `npm install`, `bun.lock` → `bun install`; with no lockfile, the
  root's `packageManager` field (corepack) decides, npm as the last resort. One install
  runs per folder that owns a lockfile among the changed packages (see
  [Independent packages](#independent-packages---all)).
- `--include-peers` also moves `peerDependencies`, with the rule described in
  [Peer dependencies of a library](#peer-dependencies-of-a-library).
- `--release X` is the escape hatch for a copy whose tag you cannot choose: the one
  installed as a devDependency and run from `scripts`. From `npx`, prefer the tag.

`bump` replaces `npm-check-updates` for the node-opcua family. If you use `ncu` for the
rest of your dependencies, exclude the family so the two tools do not compete:

```bash
npx npm-check-updates -u -x "node-opcua*"
```

Both `bump` and `check` audit the manifest's `scripts` for an `ncu` / `npm-check-updates`
invocation that does not exclude the family (`-x "node-opcua*"` or `--reject`), and warn
with that fix; for `check` it is a failure, since such a script would undo the pins on its
next run. A convenient layout is one script per family:

```json
{
    "scripts": {
        "deps:update": "npm-check-updates -u -x \"node-opcua*\" && node-opcua-versions bump --install",
        "deps:check": "node-opcua-versions check -w --offline"
    }
}
```

### expand

```bash
npx node-opcua-versions@latest expand [--release <version>] [--dry-run] [-w | -a]
```

Sterfive's professional packages (`@sterfive/opcua-optimized-client`, ...) do not bundle
node-opcua; they declare it as **peer dependencies** and expect your application to
declare them, explicitly, at versions of one release. `expand` reads the peer
dependencies of every non-node-opcua dependency in your manifest (through `npm view`, so
a private registry configured in `.npmrc` works as it does for `npm install`) and adds
the missing `node-opcua-*` peers at the versions of **your** release, inferred from your
`node-opcua` pin.

```text
$ npx node-opcua-versions@latest expand
  release 2.181.1
  + node-opcua-debug                                  2.181.0   (required by @sterfive/opcua-optimized-client@1.35.0)
  + node-opcua-pseudo-session                         2.181.1   (required by @sterfive/opcua-optimized-client@1.35.0)
  = node-opcua                                        2.181.1
  wrote ./package.json
```

When a dependency's peer range excludes your release's version, `expand` reports the
conflict and exits 1 instead of writing a version that does not fit: that dependency does
not support your release yet, and the right move is to wait for it or to `bump --release`
to one it supports.

### check

```bash
npx node-opcua-versions@latest check [--release <version>] [--fix] [-w | -a]
```

Verifies that every `node-opcua-*` dependency is an exact pin belonging to one release,
and exits 1 otherwise. The release is inferred from the `node-opcua` pin (or, without it,
from the other pins), or forced with `--release`.

```text
$ npx node-opcua-versions@latest check
  release 2.181.1
  ! node-opcua-pseudo-session is written as a range (^2.179.0); pin it exactly
  ! node-opcua-debug is 2.179.0, release 2.181.1 carries 2.181.0
```

`--fix` repairs what it reports: every range and every off-release pin in `dependencies`
and `devDependencies` is rewritten to the exact version of the release the manifest is on.
It never changes release; that is `bump`.

When the pins belong to no published release, `check` fails and says so rather than
passing for lack of a mismatch. Workspace links (`workspace:*`, `link:`, `file:`) are
never treated as versions, whatever the package is called. `check` looks at manifests;
for the installed tree (is there one copy of each package under `node_modules`?) see
[Relationship with other tools](#relationship-with-other-tools).

### show and releases

```bash
npx node-opcua-versions@latest releases          # every published release, newest first
npx node-opcua-versions@latest show [2.179.0]    # the packages of a release, and the external versions it pins
```

### Workspaces: `-w`

`-w` (`--workspaces`) applies the command to the root `package.json` **and** to every
package of the workspace found at `--package`: the `packages:` list of
`pnpm-workspace.yaml`, or `workspaces` in `package.json`, or `packages` in `lerna.json`,
whichever exists first. Patterns of the form `<dir>`, `<dir>/*`, `<dir>/**` and `!...`
exclusions are understood. Each manifest is reported under its own heading.

```text
$ npx node-opcua-versions@latest bump -w --include-peers --dry-run
release 2.181.1 (2026-09-05)

== package.json
  node-opcua                                          2.180.0  ->  2.181.1   (devDependencies)

== packages/node-opcua-pubsub-server/package.json
  node-opcua                                        >=2.180.0  ->  >=2.181.1   (peerDependencies)
  node-opcua-address-space                          >=2.180.0  ->  >=2.181.1   (peerDependencies)
  node-opcua                                          2.180.0  ->  2.181.1   (devDependencies)
```

This is how a monorepo moves to a new node-opcua release in one command: the root's and
the packages' development pins become the new exact versions, and the packages' peer
ranges get the new floor.

### Independent packages: `--all`

A repository often carries packages that the workspace excludes on purpose (a snap, a
documentation site, a standalone copy meant for publication) or that keep their own
lockfile inside the workspace, and those pin node-opcua too. `-a` (`--all`) works on
**every** `package.json` under `--package`, workspace member or not, skipping
`node_modules` and build output. With `--install`, one install runs per folder that owns
a lockfile among the changed packages, outermost first, with the package manager that
lockfile implies: `pnpm install` at the root for the packages it manages, `npm install`
inside a snap that has its own `package-lock.json`, and so on.

| | manifests visited | installs |
| --- | --- | --- |
| (default) | the one at `--package` | its own lockfile owner |
| `-w` | root + workspace members, as pnpm/npm/yarn/lerna see them | one per lockfile owner |
| `-a` | root + every `package.json` in the tree | one per lockfile owner |

`check` and `expand` report each manifest on its own release: an independent package is
allowed to sit on another release than the workspace, and is judged against that one.

### Peer dependencies of a library

A library must not pin its host: a pinned peer forces one exact version on every
application and produces a duplicate copy in any application that resolves another patch.
So `--include-peers` moves the **floor** of a peer range and keeps its shape:

| before | after `bump --include-peers` to 2.181.1 |
| --- | --- |
| `>=2.179.0` | `>=2.181.1` |
| `^2.179.0` | `^2.181.1` |
| `2.179.0` | `2.181.1` |
| `*`, `>=2.170.0 <3` | unchanged |

Without `--include-peers`, peers are never touched. `check` never reads them either: a
peer is a statement about accepted hosts, not a pin to verify.

### Common options

| Option | Meaning |
| --- | --- |
| `-p, --package <path>` | the `package.json`, or its folder, to work on (default: the current folder) |
| `-w, --workspaces` | also every package of the workspace rooted at `--package` |
| `-a, --all` | every `package.json` under `--package`, workspace member or not |
| `--offline` | never touch the registry: only the release bundled with this copy is known |
| `--registry <url>` | the registry that publishes `node-opcua-versions` (default `https://registry.npmjs.org`) |

## Why: a release is a set, not a number

node-opcua is a monorepo of about a hundred and thirty packages published separately:
`node-opcua-client`, `node-opcua-server`, `node-opcua-types`, `node-opcua-nodesets`, the
companion nodesets, and the `node-opcua` umbrella that depends on sixty of them.

A release has a name, `2.181.1`, but **not every package carries that number**. Only the
packages that changed since the previous release are bumped and republished; an unchanged
package keeps its version. Release 2.181.1 is made of 36 packages at `2.181.1`, 83 at
`2.181.0` and `node-opcua-assert` at `2.179.0`. So `node-opcua@2.181.1` depends on
`node-opcua-debug@2.181.0`, and both are exactly right.

Two rules of the monorepo make "a release" a well-defined set:

1. **Every dependency between node-opcua packages is an exact pin**, never a range.
2. **A bump cascades.** When a package is bumped, every package that depends on it has
   its pin rewritten, which makes that package changed too, so it is bumped and
   republished as well.

Consequence: at any moment the latest published version of every `node-opcua-*` package
forms one coherent set, in which every pin is satisfied by exactly one installed copy.
Different numbers inside that set are normal; the same number everywhere is a coincidence.

What breaks a set is not "an old version" but **two copies of one package** in one
application: upgrading one member of the family and not the others, or a caret range
that lets npm drift one package ahead of the rest. Two copies of `node-opcua-types` mean
two `BrowseResult` classes that TypeScript will not assign to each other, `instanceof`
that lies, and a type registered in one copy's registry that the other copy cannot find.
The commands above exist so that this never happens by accident.

Two questions are hard to answer from npm alone, and this package answers both:

- *Which versions belong together?* For the sixty packages under the umbrella, the answer
  is the umbrella's exact-pin closure. For the fifty that sit beside it (nodesets, alias
  names, roles, file transfer, the modeler, ...) nothing on npm relates them to a release.
- *Which version of `node-opcua-crypto` and `node-opcua-pki` does this release expect?*
  Those two live in other repositories with their own numbering; each node-opcua release
  pins them exactly, but the pin is buried in `node-opcua-certificate-manager`.

## Where the matrix lives: the registry is the history

`node-opcua-versions` is published with **every** release, force-bumped so that its version
number *is* the release name, and its `package.json` carries the set of that release under
`nodeOpcuaRelease`:

```json
{
    "name": "node-opcua-versions",
    "version": "2.181.1",
    "nodeOpcuaRelease": {
        "release": "2.181.1",
        "date": "2026-09-05",
        "packages": { "node-opcua": "2.181.1", "node-opcua-debug": "2.181.0", "...": "..." },
        "external": { "node-opcua-crypto": "5.10.1", "node-opcua-pki": "6.22.0" }
    }
}
```

- `packages` are the public packages of the monorepo at that release.
- `external` are the node-opcua packages that live outside the monorepo and follow their
  own versioning, at the exact version the release pins them to. `bump`, `expand` and
  `check` treat them like any other package of the release.

Because a registry serves a version's manifest without a download, the set of **any**
release is one small request away: `https://registry.npmjs.org/node-opcua-versions/2.180.0`
returns the set of release 2.180.0, immutable, about 9 KB. That is the whole history, and
nothing accumulates in the package: a copy of this tool bundles exactly one set, its own.

| What you ask | Where the answer comes from |
| --- | --- |
| the release this copy was published with | the bundle, no network |
| the newest release | `<registry>/node-opcua-versions/latest` |
| any other published release | `<registry>/node-opcua-versions/<release>` |
| a release before this package existed | not available: nothing was published for it |

`--offline` restricts every command to the bundled set. And the publish order is the race
protection: a node-opcua release publishes a hundred packages one after the other over
several minutes, nothing on npm tells a user that this is happening, and a tool that reads
"the latest of each" during those minutes assembles a half-old, half-new set without
anyone noticing. `node-opcua-versions` is published **last**: when its entry for a release
is on the registry, every package of that release already is, so the tool cannot see a
release before it is complete and the user never has to think about timing (how that
order is enforced is described [for maintainers](#for-node-opcua-maintainers)).

## Use from code

```ts
import { bundledSet, ReleaseMatrix, registryClient, resolveRelease } from "node-opcua-versions";

const matrix = new ReleaseMatrix([bundledSet()]); // the release this copy was published with
const client = registryClient();

const r2180 = await resolveRelease("2.180.0", matrix, client); // read once, then remembered
r2180.packages["node-opcua-debug"]; // "2.180.0"
r2180.external["node-opcua-pki"]; // "6.22.0"
matrix.releasesOf("node-opcua-assert", "2.179.0"); // every loaded release that carried it
```

The commands are pure functions over an in-memory manifest, for tools that embed them
without a file system or a network: `inferRelease`, `planBump` / `applyChanges`,
`planExpand` / `applyExpand`, `planCheck`, `rewritePeerSpecifier`, `auditScripts`.
`readManifest` / `writeManifest` read and write a `package.json` without changing its
indentation, line endings or trailing newline, so that a two-line change stays a two-line
diff. `discoverWorkspaceManifests` and `discoverAllManifests` list a repository's
manifests, `installRoots` the folders an install must run in. The registry access is
behind the small `RegistryClient` interface, easy to replace in tests.

## In CI and git hooks

`check` is fast and, with `--offline`, deterministic:

```json
{
    "scripts": {
        "check:node-opcua": "node-opcua-versions check -w --offline"
    },
    "devDependencies": {
        "node-opcua-versions": "2.181.1"
    }
}
```

As a devDependency the tool is pinned like the rest of the family; its version **is** the
release your project is on, so the local `node-opcua-versions bump` re-pins to that very
release (and reports when a newer one exists), and `npx node-opcua-versions@latest bump`
moves the project, this devDependency included, to the newest. `expand` needs the
registry (it reads peer dependencies through `npm view`) and belongs in a CI job with
network access, or in the upgrade routine rather than in a hook.

## Relationship with other tools

| Tool | Reads | Answers |
| --- | --- | --- |
| `node-opcua-versions bump` | the release matrix | move manifests to one release |
| `node-opcua-versions expand` | your dependencies' peer ranges + the matrix | declare the peers `@sterfive/*` needs, at your release |
| `node-opcua-versions check` | manifests + the matrix | are all pins from one release? (`--fix` repairs) |
| `npm-check-updates -x "node-opcua*"` | the registry | everything that is not node-opcua |
| `diagnose-node-opcua` (`@ster5/check-version-consistency`) | `node_modules` | is there exactly one installed version of each package? |
| `diagnose-node-opcua --check-imports` | your sources | do you declare everything you import? |

The two `diagnose-node-opcua` checks are complementary to `check`: this tool reasons about
manifests, they reason about the installed tree and the source code.

## FAQ

**Must the numbers in my `package.json` all match?** No. `node-opcua 2.181.1` next to
`node-opcua-debug 2.181.0` is a correct set. Duplicates are the problem, not different
numbers. Do not "fix" `2.181.0` to `2.181.1` by hand: that version may not exist, and if
it does you have just left the set. `check --fix` does it right.

**Does it handle `node-opcua-crypto` and `node-opcua-pki`?** Yes. They are not in the
monorepo, but every release pins them exactly; the set records those pins under
`external`, and the commands treat them like any other package of the release.

**What about `@sterfive/*` packages themselves?** They are not in the matrix; `bump`
leaves them alone (use `ncu` for them, or your own judgement), and `expand` reads their
peer requirements to complete your manifest. A professional package that does not yet
support your release is reported as a conflict by `expand`.

**Does the package grow with every release?** No. Each published version carries one set,
its own; the history is the sequence of published versions on the registry, which npm
stores anyway. At two releases a week for ten years the tool's footprint is the same 9 KB.

**I want release X, not the latest.** `npx node-opcua-versions@X bump`, or `bump
--release X` from any copy; both read the set of X from the registry
(`node-opcua-versions@X`), and both work downwards, which makes a rollback one command.
Releases that predate this package have no set; their manifests are in the repository's
git tags.

**Should I install it with `-g`?** No need. `npx node-opcua-versions@<release>` is the
documented way; a global copy is one fixed release, and `bump` will tell you when a newer
one exists, but it is one more thing to keep current.

**Exact pins, really?** For an application, yes: an exact pin plus a committed lockfile
is the only combination that installs the same tree twice. A library that must coexist
with its host's node-opcua should instead declare `peerDependencies` with `>=` ranges and
let the application pin, which is exactly what `bump --include-peers` maintains.

## For node-opcua maintainers

Nothing in this section concerns a user of the package. The release set is produced by
`tools/generate-release-set.mjs` at the root of the monorepo, a maintainer tool that is
not shipped with the package:

```bash
node tools/generate-release-set.mjs             # report the set and whether package.json is up to date; writes nothing
node tools/generate-release-set.mjs --check     # the same, exit 1 when the field is stale (root: pnpm run check:releases)
node tools/generate-release-set.mjs --write     # rewrite the field (tag-based when the tag exists; root: pnpm run build:releases)
node tools/generate-release-set.mjs --stage     # --write, then git add package.json (what the version lifecycle uses)
```

It reads `lerna.json` for the release name and the workspace folders, and every public
package's `package.json` for its version and for the external `node-opcua-*` packages it
pins, and writes the `nodeOpcuaRelease` field of this package's manifest. It refuses to run
when this package's version is not the release name, which is the invariant every consumer
relies on.

It runs as the root package's `version` lifecycle script during `lerna version`, after every
manifest and lerna.json have been bumped and before the release commit, and stages its output
so that it lands in that commit. It cannot be this package's own `version` script: lerna runs
those before it writes lerna.json, so the release name would still be the previous one. The
root `version:lerna` script passes
`--force-publish=node-opcua-versions` so that this package is part of every release even
when nothing else in it changed: its content always changes.

A release that has already been tagged is described from its tag (`git show v2.181.1:...`),
never from the working tree: between two releases the tree gains packages and pins that
are not published under that number. The working tree is read only during `lerna
version`, when the tag does not exist yet and the bumped tree is exactly what is about to
be published.

**Publish order.** The package is marked `private` in the repository, which makes
`lerna publish` skip it in the main pass; the publish workflow then runs a second, final
`lerna publish from-package --include-private node-opcua-versions`, which lifts the flag
for this one package and publishes whatever the first pass left, i.e. this package alone:
lerna includes a private package only when its exact name is listed, so the repository's
other private packages (tests, fixtures, the playground) stay unpublished. The published
copy carries no `private` field.
