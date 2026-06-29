# node-opcua-role-set-common

Shared types, identity stores and persistence helpers for OPC UA **RoleSet management**
(OPC 10000-18 — *Role-Based Security*).

This package holds the framework-agnostic building blocks used by both the
server (`node-opcua-role-set-server`) and the client (`node-opcua-role-set-client`)
role-set packages. It deliberately avoids depending on the heavy
`node-opcua-address-space` so it can be reused anywhere a `NodeId` and the
core OPC UA types are available.

see http://node-opcua.github.io/

## Installation

```bash
$ npm install node-opcua-role-set-common
```

## What's in the box

| Export | Description |
|--------|-------------|
| `IIdentityMappingStore` | Interface for a store of identity → role mappings (OPC 10000-18 §4.4). |
| `InMemoryIdentityMappingStore` | In-memory implementation of `IIdentityMappingStore`. |
| `AnyUserIdentityToken` | Union of `AnonymousIdentityToken \| UserNameIdentityToken \| X509IdentityToken`. |
| `WellKnownRoles` | Numeric identifiers of the standard OPC UA roles (re-exported from `node-opcua-constants`). |
| `WellKnownRoleIds` | Pre-built `NodeId` objects for each well-known role. |
| `saveToBinaryFile` / `loadFromBinaryFile` | Persist / restore a store to / from a binary file. |
| `encodeIdentityStore` / `decodeIdentityStore` / `identityStoreBinaryStoreSize` | Lower-level binary (de)serialization helpers. |

## The identity mapping store

A store maps an `IdentityMappingRuleType` (OPC 10000-18 §4.4) to a role `NodeId`,
and can resolve which roles a given user identity token is granted.

```ts
import {
    InMemoryIdentityMappingStore,
    WellKnownRoleIds
} from "node-opcua-role-set-common";
import { IdentityCriteriaType, IdentityMappingRuleType, UserNameIdentityToken } from "node-opcua-types";

const store = new InMemoryIdentityMappingStore();

// grant the SecurityAdmin role to the user "admin"
store.addIdentity(
    WellKnownRoleIds.SecurityAdmin,
    new IdentityMappingRuleType({
        criteriaType: IdentityCriteriaType.UserName,
        criteria: "admin"
    })
);

// resolve roles for an incoming user identity token
const roles = store.resolveRoles(new UserNameIdentityToken({ userName: "admin" }));
// -> [ NodeId(SecurityAdmin) ]
```

### Supported criteria types

`resolveRoles` understands the following `IdentityCriteriaType` values:

| Criteria | Matches when |
|----------|--------------|
| `Anonymous` | the token is an `AnonymousIdentityToken`. |
| `AuthenticatedUser` | the token is *not* anonymous. |
| `UserName` | a `UserNameIdentityToken` whose `userName` equals `criteria`. |
| `Thumbprint` | an `X509IdentityToken` whose SHA-1 certificate thumbprint equals `criteria`. |
| `X509Subject` | an `X509IdentityToken` whose certificate subject matches `criteria`. |

> **`X509Subject` matching** accepts two formats:
> - the ordered Distinguished Name format from OPC 10000-18 §4.4.3 (Table 10),
>   e.g. `CN="Jane Doe"/O="ACME"` — every mappable subject attribute present in
>   the certificate (CN, O, OU, L, S, C) must also be present in the criteria;
> - a plain Common Name string (legacy), compared against the certificate's `commonName` only.
>
> The helpers (`matchX509Subject`, `canonicalizeX509Subject`, `parseX509SubjectCriteria`,
> `certificateSubjectPairs`) are exported for reuse. `DC`, `dnQualifier` and `serialNumber`
> are not extracted from certificates and are ignored.

### Well-known roles

`WellKnownRoleIds` saves you from repeatedly calling `resolveNodeId(...)`:

```ts
import { WellKnownRoleIds } from "node-opcua-role-set-common";

WellKnownRoleIds.Anonymous;
WellKnownRoleIds.AuthenticatedUser;
WellKnownRoleIds.Observer;
WellKnownRoleIds.Operator;
WellKnownRoleIds.Engineer;
WellKnownRoleIds.Supervisor;
WellKnownRoleIds.ConfigureAdmin;
WellKnownRoleIds.SecurityAdmin;
```

## Persistence

A store can be serialized to a compact binary file using OPC UA binary encoding:

```ts
import { saveToBinaryFile, loadFromBinaryFile } from "node-opcua-role-set-common";

await saveToBinaryFile(store, "./config/roles.bin");

// later, possibly after a restart
await loadFromBinaryFile(store, "./config/roles.bin");
```

- `saveToBinaryFile` creates the parent directory if needed.
- `loadFromBinaryFile` is a no-op when the file is missing or empty.
- `decodeIdentityStore` **merges** into the existing store (it does not clear it first).

### File format

```
UInt32                          number of roles
repeat for each role:
  NodeId                        role NodeId
  Variant(ExtensionObject[])    identity mapping rules
```

## Related packages

- [`node-opcua-role-set-server`](../node-opcua-role-set-server) — installs the RoleSet & User Management Methods on a server.
- [`node-opcua-role-set-client`](../node-opcua-role-set-client) — client-side helpers to browse roles, read/change identities and manage users.
- [`node-opcua-role-set-admin`](../node-opcua-role-set-admin) — the `role-set-admin` command-line tool.
- [Role-Based Security & User Management guide](https://github.com/node-opcua/node-opcua/blob/master/documentation/role_based_security.md) — cross-package overview & getting started.

# License

Node-OPCUA is made available to you under the MIT open source license.

See [LICENSE](./LICENSE) for details.

# Copyright

Copyright (c) 2022-2026 Sterfive SAS - https://www.sterfive.com

Copyright (c) 2014-2022 Etienne Rossignon
