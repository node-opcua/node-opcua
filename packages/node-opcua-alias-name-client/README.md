# node-opcua-alias-name-client

Client-side OPC UA **AliasNames** (OPC 10000-17).

These packages let a Server publish **its own** AliasNames and let a Client resolve
them. They do **not** aggregate AliasNames collected from other Servers: Annex B
(aggregating Server) and Annex C (GDS) of OPC 10000-17, and the Annex D PubSub change
notification, are out of scope. Anything that requires knowing about more than one
Server is not implemented here.

see http://node-opcua.github.io/

## What it is for

Part 17 is, in effect, DNS for an address space. Instead of configuring a Client with a
raw NodeId that changes whenever the Server is re-engineered, ask for the plant tag:

```ts
import { ClientAliasSet } from "node-opcua-alias-name-client";

const aliases = new ClientAliasSet(session);
const [entry] = await aliases.findAlias("TI101");
const nodeId = entry.referencedNodes[0];
```

## Installation

```bash
npm install node-opcua-alias-name-client
```

## Works with any session

`ClientAliasSet` takes an `IBasicSessionAsync2`, so the same code drives a remote
`ClientSession` and an in-process `PseudoSession`:

```ts
const aliases = new ClientAliasSet(new PseudoSession(addressSpace));
```

That is what lets this package be tested without a transport, and what lets a
Server-side tool resolve its own aliases through the API a Client uses.

## Searching

The argument is an OPC 10000-4 `Like` pattern — `%` is any run of characters, `_` exactly
one, `[abc]` and `[^abc]` are lists, `\` escapes. An exact name is a pattern with no
wildcards.

```ts
await aliases.findAlias("TI101");                              // exact
await aliases.findAlias("TI%");                                // prefix
await aliases.findAlias("%", { categoryNodeId: TAG_VARIABLES }); // one branch
```

The search is recursive from the category given, defaulting to the `Aliases` root, so one
call covers everything the Server publishes.

Results are **typed**, never raw Variants: `aliasName` is a string, `referencedNodes` is
`ExpandedNodeId[]`, ordered best match first (clause 6.3.2).

No match is an empty array, not an error — clause 6.3.2 Table 3 makes that a `Good`
response. A Server-side failure raises `AliasNameCallError`, which carries the StatusCode
so the cases of Table 4 stay distinguishable:

```ts
try {
    await aliases.findAlias(userSuppliedPattern);
} catch (err) {
    if (err instanceof AliasNameCallError && err.statusCode.equals(StatusCodes.BadResponseTooLarge)) {
        // ask the user to narrow the pattern
    }
}
```

## `FindAliasVerbose` is optional — handle its absence

Only `FindAlias` is MANDATORY (clause 6.3). A Server exposing nothing else is perfectly
conformant, so its absence is an outcome to handle rather than a fault:

```ts
if (await aliases.supportsVerbose()) {
    const entries = await aliases.findAliasVerbose("TI101");
    entries[0].aliasNameCategoryId;  // which category held it
    entries[0].serverUris;           // parallel to referencedNodes; null = this Server
}
```

Calling it anyway raises `AliasNameMethodNotSupportedError`, naming the Method and the
category, **before any call is made** — the absence is discovered while resolving NodeIds,
so it never arrives as an unhandled `Bad_NotImplemented` from the wire.

`supportsConfiguration()` does the same for `AddAliasesToCategory` /
`DeleteAliasesFromCategory`.

## Method NodeIds are resolved once

All four Methods of a category are resolved in a **single** `translateBrowsePath` round
trip and cached for the life of the instance — asking for four costs no more than asking
for one, so a later `findAliasVerbose` after a `findAlias` makes no further round trip.
Construct one `ClientAliasSet` per session; call `invalidate()` if the Server's address
space changes underneath it.

## Recovering the ReferenceType of each target

`AliasNameDataType` and `AliasNameVerboseDataType` (clauses 7.2 and 7.3) carry the
referenced Nodes but **not** the ReferenceType of each Reference: a target linked with a
vendor subtype of `AliasFor` (clause 8.2) comes back indistinguishable from one linked
with `AliasFor` itself. That is a limitation of the DataTypes, not of any Server.

Most Clients never care — they want the NodeId. An **aggregator** re-publishing pulled
aliases does: recorded as plain `AliasFor`, a downstream `FindAlias` whose
`ReferenceTypeFilter` names the subtype can no longer be answered faithfully across the
aggregation hop. `readAliasReferenceTypes` recovers the actual ReferenceType per
(alias, target) by browsing the `AliasNameType` instance Nodes:

```ts
import { readAliasReferenceTypes } from "node-opcua-alias-name-client";

const entries = await aliases.findAliasVerbose("%", { categoryNodeId });
const referenceTypes = await readAliasReferenceTypes(session, entries);
for (const entry of entries) {
    for (const { targetNodeId, referenceTypeId } of referenceTypes.get(entry) ?? []) {
        republish(entry.aliasName, targetNodeId, referenceTypeId);
    }
}
```

The map is keyed by the very elements passed in; an entry the Server could not resolve
(deleted since the find, for instance) is absent rather than guessed at. Callers that
already know the `AliasNameType` instance NodeIds can pass those instead of verbose
entries and skip the lookup step.

**Cost.** One `TranslateBrowsePaths` request per 1000 aliases to locate the instance
Nodes (skipped when NodeIds are passed), one `Browse` request per 1000, plus a
`BrowseNext` round trip per continuation the Server imposes — batched precisely so a
large category is a handful of round trips, never one per alias. Lower `maxNodesPerCall`
when a Server advertises tighter `OperationLimits` (OPC 10000-5 clause 6.3.11). If you
only resolve names to NodeIds, skip all of it.

## Nodes on another Server (Annex A)

A returned `ExpandedNodeId` may carry a non-zero `ServerIndex`, which says only "this Node
is somewhere else" — the index means nothing without the Server's `ServerArray`. That
lookup is the step every Client has to perform, so it is here rather than in each caller:

```ts
const located = await aliases.serverIndexResolver.locate(entry.referencedNodes[0]);
if (!located.local) {
    connectTo(located.serverUri);
}
```

The `ServerArray` is read once and cached. Every Node these packages publish is local, so
`local` is always true against a Server built with `node-opcua-alias-name-server`; this
matters when talking to a Server that does aggregate.

## Browsing the hierarchy

Resolving an alias needs no browsing — `findAlias` on the root searches recursively — but
a Client that wants to show the tree, or search one branch, can walk it:

```ts
for (const category of await aliases.browseSubCategories()) {
    console.log(category.browseName, category.nodeId.toString());
}
```

Only `AliasNameCategoryType` instances are returned; the `AliasNameType` instances a
category also Organizes are not categories and are filtered out.

## License

MIT — see [LICENSE](./LICENSE).
