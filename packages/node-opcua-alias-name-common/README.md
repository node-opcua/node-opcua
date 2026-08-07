# node-opcua-alias-name-common

Shared types and `VersionTime` helpers for OPC UA **AliasNames** (OPC 10000-17), plus a
re-export of the OPC 10000-4 `Like` matcher.

These packages let a Server publish **its own** AliasNames and let a Client resolve
them. They do **not** aggregate AliasNames collected from other Servers: Annex B
(aggregating Server) and Annex C (GDS) of OPC 10000-17, and the Annex D PubSub change
notification, are out of scope. Anything that requires knowing about more than one
Server is not implemented here.

This package holds the framework-agnostic pieces used by both
`node-opcua-alias-name-server` and `node-opcua-alias-name-client`. It deliberately depends
on nothing heavier than `node-opcua-nodeid` and the dependency-free
`node-opcua-like-matcher`.

see http://node-opcua.github.io/

## Installation

```bash
npm install node-opcua-alias-name-common
```

## What's in the box

### The `Like` matcher (OPC 10000-4, Table 120)

`FindAlias` takes an `AliasNameSearchPattern`, which is a `Like` pattern. The matcher
itself lives in **[`node-opcua-like-matcher`](../node-opcua-like-matcher/README.md)** —
`Like` is a Part 4 primitive that `QueryApplications` (OPC 10000-12) and event filter
ContentFilters also need, and none of them should have to depend on the AliasName package
to get a dependency-free string matcher.

It is re-exported here so Part 17 consumers have a single import:

```ts
import { like, isValidLikePattern, LikePattern, InvalidLikePatternError } from "node-opcua-alias-name-common";

like("TI101", "TI%");          // true
like("abc4", "abc[13-68]");    // true
like("axb", "a.b");            // false - metacharacters are literal
```

See that package's README for the wildcard table, the case-sensitivity rules, the reading
of `\` inside a character list, and the cost bounds and 2048-character pattern limit that
keep a wire-supplied pattern from exhausting memory.

### `VersionTime` (OPC 10000-4 clause 7.43)

The `LastChange` Property of an `AliasNameCategoryType` is a `VersionTime`: a **UInt32
count of seconds since 2000-01-01T00:00:00Z**. It is *not* a `DateTime`, which is the
easiest thing to get wrong here.

```ts
import { toVersionTime, fromVersionTime, maxVersionTime } from "node-opcua-alias-name-common";

toVersionTime(new Date("2000-01-01T00:00:00Z")); // 0
fromVersionTime(86400);                          // 2000-01-02T00:00:00.000Z
```

Two consequences worth designing around:

- **Resolution is one second.** Two changes inside the same second are
  indistinguishable. A Client that sees a `LastChange` *equal* to its cached value should
  re-browse rather than assume nothing changed; only a value *older* than the cached one
  means "drop the cache" (clause 6.3.1).
- **It wraps in 2136** (`VERSION_TIME_WRAP_DATE`, 2136-02-07T06:28:16Z). There is nothing
  in the specification to do about this; it is documented, not handled. Instants before
  the epoch clamp to `0` rather than wrapping to a far-future value.

`maxVersionTime` is the rollup used by clause 6.3.1, where a nested category's
`LastChange` is the latest of all its descendants.

### `IAliasStore`

> **Experimental.** The shape of `IAliasStore` is expected to move before it is
> considered stable. It is exported so a Server can back its aliases with something
> other than the address space — a database, a configuration file, an existing tag
> dictionary — but treat it as provisional.

`AliasEntry` carries the string part of the alias name as its identity, because clause 6.2
requires the namespace to be ignored when comparing AliasNames — but
`aliasNameNamespaceUri` still reports the namespace it was published in, so a Server does
not have to invent one. Omit it and the binding falls back to the Server's own namespace,
never to namespace 0, which is reserved for the OPC Foundation.

Three arrays are parallel to `referencedNodes`, same length and same order:

| Field | Meaning |
|---|---|
| `serverUris` | `null` for a Node on the local Server (clause 7.3) |
| `referenceTypeIds` | `AliasFor` or the subtype reaching *that* target (clause 8.2) |

The order of `referencedNodes` is the store's responsibility and is never reordered: an
`AliasComparator` orders entries relative to one another, and merging by name appends
rather than re-sorts.

`add` and `delete` return one `StatusCode` per entry, parallel to the entries passed in,
because clauses 6.3.4 and 6.3.5 report per item rather than per call — a single target on
another Server yields `Uncertain_ReferenceOutOfServer` while its siblings succeed.

## License

MIT — see [LICENSE](./LICENSE).
