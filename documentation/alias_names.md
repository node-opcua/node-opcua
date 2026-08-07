# AliasNames (OPC 10000-17)

AliasNames are, in effect, DNS for an address space. A Client asks for the plant tag
`TI101` and gets back the NodeId it currently resolves to, instead of being configured
with that NodeId in advance. It is the standard bridge between ISA-5.1 style tag names and
explicitly modelled OPC UA Nodes.

> **Scope.** The `node-opcua-alias-name-*` packages let a Server publish **its own**
> AliasNames and let a Client resolve them. They do **not** aggregate AliasNames collected
> from other Servers: Annex B (aggregating Server) and Annex C (GDS) of OPC 10000-17, and
> the Annex D PubSub change notification, are out of scope.

## Why you probably need this already

Every node-opcua Server that loads the standard nodeset **already exposes** `Aliases`,
`TagVariables` and `Topics`, each carrying a MANDATORY `FindAlias` Method. Until this
package is installed, that Method is bound to nothing: a conformance tester sees the
Server advertise the AliasName feature and then fail its only required Method.

One call fixes it:

```ts
import { installAliasNames } from "node-opcua-alias-name-server";

await server.start();
await installAliasNames(server);
```

## Advertise the capability

**Do this.** A Server that does not advertise `ALIAS` is never discovered by anything
looking for alias-capable Servers, and the failure is silent — nothing errors, the Server
simply never appears.

```ts
const server = new OPCUAServer({
    // OPC 10000-12 Annex D Table D.1
    capabilitiesForMDNS: ["ALIAS"]
});
```

The normative identifier is `ALIAS`, matched case-insensitively. Part 17's prose writes it
`Alias`; Part 12 Annex D is the normative source.

## Three ways to declare an alias

### 1. Modelled in NodeSet2.xml, at design time

The best option when the tag list is known to the engineering tool. Model
`AliasNameType` instances under a category and the Server needs no application code at
all — `installAliasNames(server)` with no options answers `FindAlias` from them, because
the default store reads the address space directly.

```xml
<UAObject NodeId="ns=1;i=5001" BrowseName="1:TI101">
  <DisplayName>TI101</DisplayName>
  <References>
    <Reference ReferenceType="HasTypeDefinition">i=23455</Reference>
    <!-- Organized by TagVariables (i=23479) -->
    <Reference ReferenceType="Organizes" IsForward="false">i=23479</Reference>
    <!-- AliasFor the Node it names -->
    <Reference ReferenceType="i=23469">ns=2;i=1043</Reference>
  </References>
</UAObject>
```

Clause 6.2 requires the BrowseName's string part to equal the DisplayName, with an empty
locale and no other locale, and at least one `AliasFor` Reference. The address space *is*
the database here — there is nothing to keep in sync.

### 2. Programmatically, with `addAlias`

For a Server whose address space is built in code:

```ts
import { addAlias, removeAlias, WellKnownCategories } from "node-opcua-alias-name-server";

addAlias(addressSpace, WellKnownCategories.TagVariables, "TI101", temperatureVariable);
removeAlias(addressSpace, WellKnownCategories.TagVariables, "TI101");
```

`addAlias` enforces clause 6.2 so a non-conformant alias cannot be built, and enforces the
category restrictions where the target is local and checkable: `TagVariables` accepts only
Variables (clause 9.3), `Topics` only `PublishedDataSetType` instances or subtypes
(clause 9.4).

**There is deliberately no rename.** Clause 6.2 makes the BrowseName immutable — "If an
AliasName is to be changed, it shall be a deletion of the old AliasName and the addition
of the new AliasName" — which yields a new NodeId. That NodeId change is how an
aggregating Server notices, so a rename API would quietly break aggregation downstream.

For vendor categories, `addAliasCategory` creates **and binds** in one step, so a category
created after installation cannot end up with an unbound `FindAlias`:

```ts
import { addAliasCategory } from "node-opcua-alias-name-server";

const unit200 = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "Unit200");
addAlias(addressSpace, unit200, "LSH-201", levelSwitch);
```

### 3. Remotely, via `AddAliasesToCategory`

> **Not implemented in this release.** `configurationMethods: true` throws rather than
> exposing Methods that do nothing. The store interface already returns the per-item
> `StatusCode[]` that clauses 6.3.4 and 6.3.5 require, so the facet can be added without
> a breaking change.

When it lands, a Client will be able to add aliases at run time, gated by
`isWriteAllowed`, which defaults to denying everyone.

## Resolving an alias from a Client

```ts
import { ClientAliasSet } from "node-opcua-alias-name-client";

const aliases = new ClientAliasSet(session);
const [entry] = await aliases.findAlias("TI101");
const dataValue = await session.read({ nodeId: entry.referencedNodes[0], attributeId: AttributeIds.Value });
```

The argument is an OPC 10000-4 `Like` pattern — `%`, `_`, `[abc]`, `[^abc]`, `\` — so an
exact name is simply a pattern with no wildcards. The search is recursive from the
category given, defaulting to the `Aliases` root, so one call covers everything.

`ClientAliasSet` takes an `IBasicSessionAsync2`, so the same code drives a remote
`ClientSession` and an in-process `PseudoSession`.

Only `FindAlias` is MANDATORY. A Server offering nothing else is conformant, so check
before reaching for the verbose form:

```ts
if (await aliases.supportsVerbose()) {
    const [entry] = await aliases.findAliasVerbose("TI101");
    entry.aliasNameCategoryId;   // which category held it
    entry.serverUris;            // parallel to referencedNodes; null = this Server
}
```

## Access control

OPC 10000-17 defines no security model at all — four `Bad_UserAccessDenied` rows, no
Security clause, no Roles, and no `RolePermissions` on any Part 17 node in the standard
nodeset. Every Server supplies its own rule:

```ts
await installAliasNames(server, {
    isReadAllowed: async (context, categoryNodeId) => tenantOf(context) === ownerOf(categoryNodeId)
});
```

The gate is consulted per category, at most once per call, and may be asynchronous. A
direct call on a denied category answers `Bad_UserAccessDenied`; a denied category reached
by a recursive search is **omitted, and the call still returns `Good`** — there is no
status code for "exists but not for you", so absence is the only answer that discloses
nothing.

## Trying it

A runnable sample server publishing `TI101`, `FIT-101` and `LSH-201` over an ISA-5.1 style
tag tree:

```bash
npm run sample-server --workspace node-opcua-alias-name-test
```

## Current limitations

- **`LastChange` is inert.** The Property exists but nothing writes it, so a Client
  following clause 6.3.1's cache protocol never refreshes. `persistencePath` throws rather
  than pretending to persist.
- **The configuration Methods are not implemented** (clauses 6.3.4, 6.3.5).

## The packages

| Package | Role |
|---|---|
| `node-opcua-like-matcher` | The OPC 10000-4 `Like` operator. No dependencies; `QueryApplications` and ContentFilters need it too. |
| `node-opcua-alias-name-common` | DTOs, `IAliasStore`, `VersionTime` helpers |
| `node-opcua-alias-name-server` | `installAliasNames`, the Method bindings, `AddressSpaceAliasStore` |
| `node-opcua-alias-name-client` | `ClientAliasSet`, browse helpers, `ServerIndexResolver` |
| `node-opcua-alias-name-test` | Integration suite and sample server (private) |
