# node-opcua-alias-name-server

Server-side OPC UA **AliasNames** (OPC 10000-17).

These packages let a Server publish **its own** AliasNames and let a Client resolve
them. They do **not** aggregate AliasNames collected from other Servers: Annex B
(aggregating Server) and Annex C (GDS) of OPC 10000-17, and the Annex D PubSub change
notification, are out of scope. Anything that requires knowing about more than one
Server is not implemented here.

see http://node-opcua.github.io/

## Why this exists

Every node-opcua Server that loads the standard nodeset already exposes the `Aliases`,
`TagVariables` and `Topics` Objects, each carrying a MANDATORY `FindAlias` Method that
is bound to nothing. A conformance tester therefore sees the SDK advertise the
AliasName feature and then fail its only required Method. This package binds them.

Part 17 is, in effect, DNS for an address space: a Client asks `FindAlias("TI101")` and
gets back the `ExpandedNodeId` values that name resolves to, instead of being configured
with a raw NodeId. It is the standard bridge between ISA-5.1 style plant tag names and
explicitly modelled OPC UA Nodes.

## Installation

```bash
npm install node-opcua-alias-name-server
```

## Zero configuration

If your NodeSet2.xml already models `AliasNameType` instances, one call is the whole
integration:

```ts
import { installAliasNames } from "node-opcua-alias-name-server";

await server.start();
await installAliasNames(server);
```

`FindAlias` now answers correctly on `Aliases`, `TagVariables`, `Topics` and every
vendor subcategory nested below them. The default store reads the address space
directly, so the model *is* the database — there is nothing to keep in sync.

Calling `installAliasNames` twice is a no-op, not a double binding.

There is also an address-space-level form, for tests and tools that have no Server:

```ts
import { installAliasNamesOnAddressSpace } from "node-opcua-alias-name-server";
await installAliasNamesOnAddressSpace(addressSpace);
```

## Declaring aliases from code

For a Server whose address space is built programmatically:

```ts
import { addAlias, removeAlias, WellKnownCategories } from "node-opcua-alias-name-server";

addAlias(addressSpace, WellKnownCategories.TagVariables, "TI101", temperatureVariable);
removeAlias(addressSpace, WellKnownCategories.TagVariables, "TI101");
```

`addAlias` enforces the rules of clause 6.2 so you cannot build a non-conformant alias:
the BrowseName's string part equals the DisplayName with an empty locale and no other
locale, and at least one `AliasFor` Reference exists. It also enforces the category
restrictions where the target is local and therefore checkable — `TagVariables` accepts
only Variables (clause 9.3), `Topics` only `PublishedDataSetType` instances or subtypes
(clause 9.4).

**There is deliberately no rename.** Clause 6.2 makes the BrowseName immutable: "If an
AliasName is to be changed, it shall be a deletion of the old AliasName and the addition
of the new AliasName", which yields a new NodeId. That is what lets an aggregating Server
notice the change, so a rename API would quietly break aggregation downstream.

Adding the same name twice adds a target to the existing alias rather than creating a
second node; an exact duplicate of (name, target) is ignored.

## Options

| Option | Default | Meaning |
|---|---|---|
| `store` | `AddressSpaceAliasStore` | Where aliases come from. Inject your own to back them with a database or an existing tag dictionary. |
| `maxResults` | `1000` | Beyond this a call answers `Bad_ResponseTooLarge` (clause 6.3.2 Table 4). |
| `verbose` | `true` | Also bind `FindAliasVerbose` (clause 6.3.3). |
| `comparator` | insertion order | Result ordering (clause 6.3.2, "best match first"). |
| `isReadAllowed` | allow all | `(context, categoryNodeId) => boolean \| Promise<boolean>`, consulted per category. |
| `isWriteAllowed` | **deny all** | Same shape, for the configuration Methods. |
| `likeOptions` | case sensitive | Passed to the `Like` matcher. |
| `additionalCategoryRoots` | — | Categories modelled outside the `Aliases` hierarchy. |
| `categoryProvider` | `defaultCategoryProvider()` | Replace category discovery entirely; may be async. |
| `configurationMethods` | `false` | **Not implemented yet** — passing `true` throws. |
| `persistencePath` | — | **Not implemented yet** — passing a path throws. |

Both unimplemented options throw rather than being accepted and ignored. A Server that
believes `LastChange` is being persisted, or that the write Methods are exposed, has a
defect that is invisible locally and visible to every connected Client.

## Extending it

Everything installation does is available piecewise, so an advanced Server — a GDS, an
aggregating Server, a vendor Server with per-customer categories — does not have to
re-implement a private half.

### Categories created at runtime

`installAliasNames` binds what exists when it runs, and is a no-op if called again. A
category created afterwards would otherwise have an unbound MANDATORY `FindAlias` — the
exact defect this package removes, reappearing at runtime. Use `addAliasCategory`, which
creates *and* binds:

```ts
import { addAliasCategory, WellKnownCategories } from "node-opcua-alias-name-server";

const wells = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "Wells");
// FindAlias and FindAliasVerbose are already bound, with the options
// installAliasNames was given
```

For a category built by hand, bind it with the options installation used:

```ts
import { bindAliasCategory, getInstalledAliasNames } from "node-opcua-alias-name-server";

const installed = getInstalledAliasNames(addressSpace)!;
bindAliasCategory(addressSpace, myCategory, installed.bindingOptions);
```

`installAliasNamesOnAddressSpace` calls `bindAliasCategory` in its own loop, so there is
exactly one binding path and a late category cannot diverge from an installed one. This
matters most for `FindAliasVerbose`, whose clone-with-reserved-NodeId logic cannot
sensibly be hand-rolled.

### Dynamic category sets

`additionalCategoryRoots` only covers roots known at install time. When the set is
genuinely dynamic, replace discovery:

```ts
import { defaultCategoryProvider } from "node-opcua-alias-name-server";

await installAliasNames(server, {
    categoryProvider: async (addressSpace) => [
        ...(await defaultCategoryProvider()(addressSpace)),
        ...(await myTenantCategories(addressSpace))
    ]
});
```

`additionalCategoryRoots` is expressed through `defaultCategoryProvider`, so the two
compose rather than being parallel mechanisms.

### Per-category access control

`isReadAllowed` receives the category the Method was called on and may return a Promise,
so "may this user see *this* customer's category" is expressible, and a permission lookup
may hit a database:

```ts
await installAliasNames(server, {
    isReadAllowed: async (context, categoryNodeId) => tenantOf(context) === ownerOf(categoryNodeId)
});
```

The gate is consulted **per category**, each at most once per call, and the outcome
differs by how the category was reached:

| Situation | Result |
|---|---|
| Direct call on a denied category | `Bad_UserAccessDenied` — nothing left to filter |
| Denied category reached by a recursive search | Omitted; the call still returns `Good` |

Absence is the only answer that discloses nothing: an error, or a count that changed,
would confirm the category exists. `FindAliasVerbose` filters at the same point as
`FindAlias`, so it cannot leak an `AliasNameCategoryId` or a `ServerUri` for a category
the plain form would have hidden.

`Bad_ResponseTooLarge` is still possible for a gated caller, since the cap is applied to
the raw scan to keep truncation detectable — but it names no category.

OPC 10000-17 defines no security model at all: four `Bad_UserAccessDenied` rows, no
Security clause, no Roles, and no `RolePermissions` on any Part 17 node in the standard
nodeset. Every Server has to supply its own rule, which is why this hook exists rather
than a built-in policy.

### Removing a category

The specification does not say what happens to a category's contents, so the rule is
explicit:

```ts
removeAliasCategory(addressSpace, tenantCategory);                        // re-parent (default)
removeAliasCategory(addressSpace, tenantCategory, { orphans: "cascade" }); // delete with it
```

`reparent` moves the aliases and subcategories to the parent first, so an alias keeps its
NodeId and a Client that resolved it keeps resolving it — clause 6.2 makes a NodeId change
mean "this is a different alias". `cascade` is right when the category itself is being
retired. The three well-known categories cannot be removed; clause 9 requires them.

### Result ordering

Clause 6.3.2 requires "what it recommends as the best match first", and says the criteria
are Server specific. The examples it gives — the ServerStatus of the Server holding the
Node, load balancing — only mean anything once more than one Server is involved. A Server
publishing its own aliases has no basis to prefer one of its own Nodes over another, so
the default preserves discovery order: deterministic, and therefore stable across calls.
Supply `comparator` when your Server does have a basis.

### Denial-of-service bounds

`FindAlias` is remotely callable, usually by an anonymous session, so both of its inputs
are bounded:

- **The search pattern.** Parsing allocates one element per character, and the transport
  accepts a String up to 16 MB, so patterns over 2048 characters are refused with
  `Bad_InvalidArgument` before anything is allocated. See the cost table in
  `node-opcua-like-matcher`. Adjust with `likeOptions.maxPatternLength`.
- **The result set.** `maxResults` bounds the *work*, not just the response: the store
  stops collecting one entry past the cap rather than walking the whole hierarchy and
  discarding it. The cap is applied to the raw entries before they are merged by name,
  because merging can reduce the count and would otherwise report a truncated scan as a
  complete answer. A merge that trips the cap is therefore `Bad_ResponseTooLarge` even
  though the merged list would have been short — conservative, and consistent with
  "try new filter and repeat find".

### Category discovery

Categories are found by walking down from `Aliases`, which is where clause 9.1 puts them:
vendors "are free to add additional instances of AliasNameCategoryType under this
hierarchy". A category modelled anywhere else is not discovered — the address space keeps
no inverse `HasTypeDefinition` reference, so there is nothing to sweep. Name such a
category in `additionalCategoryRoots`, otherwise its MANDATORY `FindAlias` stays unbound.

### `FindAliasVerbose` NodeIds

The shipped `Opc.Ua.NodeSet2.xml` declares `FindAliasVerbose` on `AliasNameCategoryType`
but instantiates it on none of the three well-known categories. Upstream nonetheless
reserves fixed NodeIds for those instances (`i=24054`, `i=24063`, `i=24072`), so
installation uses them rather than server-assigned ones and an aggregating Server sees
the NodeId it expects. Vendor subcategories get a server-assigned NodeId, as they must.

## Advertise the `ALIAS` capability

**Do this.** A Server that does not advertise the capability will never be discovered by
anything looking for alias-capable Servers, and that failure is silent — nothing errors,
the Server simply never appears.

```ts
import { ALIAS_SERVER_CAPABILITY } from "node-opcua-alias-name-server";

const server = new OPCUAServer({
    serverCapabilities: { operationLimits: {}, /* ... */ }
});
// ServerCapabilities/ServerProfileArray-adjacent capability set, OPC 10000-12 Annex D
server.serverCapabilities.push(ALIAS_SERVER_CAPABILITY);
```

The normative identifier is `ALIAS` (OPC 10000-12 Annex D Table D.1), matched
case-insensitively. Part 17's prose writes it `Alias`; Part 12 Annex D is the normative
source.

## What is not here yet

- **`AddAliasesToCategory` / `DeleteAliasesFromCategory`** (clauses 6.3.4, 6.3.5 —
  conformance unit *AliasName Configuration Support*). `configurationMethods: true`
  throws. `IAliasStore.add` / `delete` are declared, and already return the per-item
  `StatusCode[]` those clauses require, but nothing calls them yet.
- **`LastChange`** (clause 6.3.1). The `LastChange` Property is **not written and not
  persisted**, and `persistencePath` throws. `AddressSpaceAliasStore` already tracks
  per-category VersionTimes and rolls them up on read, and `IAliasStore.lastChange()` and
  `WellKnownLastChange` exist, but nothing yet connects them to the address space. Do not
  assume a Client can rely on `LastChange` from this release.
- **Aggregation across Servers** (Annexes B, C) and the **Annex D PubSub change
  notification** — out of scope by design, not pending.

## License

MIT — see [LICENSE](./LICENSE).
