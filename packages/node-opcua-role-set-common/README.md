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
| `InMemoryUserManagementStore` | Local user list + password lifecycle (OPC 10000-18 §5). |
| `serializeUser` / `credentialRecord` | Build a persisted user record offline (scrypt hash, or wrap an existing credential) — no clear text at rest. |
| `PasswordHasher` / `HasherRegistry` / `ScryptHasher` / `BcryptHasher` / `defaultHasherRegistry` | Pluggable password hashing (scrypt default; bcrypt coexists). |

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

## Users & password hashing

`InMemoryUserManagementStore` keeps the local user list and implements the
AddUser / ModifyUser / RemoveUser / ChangePassword behaviour (§5.2), the password
policy, and `authenticate`. **Passwords are never stored in clear**: each user
holds a single self-describing **PHC credential string**, so multiple hashing
schemes coexist and are told apart by prefix:

```
scrypt:  $scrypt$ln=14,r=8,p=1$<b64 salt>$<b64 hash>     (default — Node core, no extra dependency)
bcrypt:  $2b$10$<salt><hash>                             (verified for interop/migration)
```

New and changed passwords are hashed with **scrypt**. A legacy **bcrypt**
credential still verifies and is transparently re-hashed to scrypt on the next
successful login (*upgrade-on-login*, driven by `HasherRegistry.needsRehash`).
Inject a custom `HasherRegistry` to add schemes (e.g. an external verifier).

> Credential operations (`authenticate` / `addUser` / `changePassword` /
> `modifyUser`) are **async** so an external verifier can be plugged in.

### Seeding without clear text

Generate a persisted record **offline** and commit that instead of a password:

```ts
import { InMemoryUserManagementStore, serializeUser, credentialRecord } from "node-opcua-role-set-common";
import { UserConfigurationMask } from "node-opcua-types";

// scrypt record from a clear password (run once at deploy time)
const rec = await serializeUser("admin", "admin-pw1", { userConfiguration: UserConfigurationMask.None });

// or wrap an already-hashed credential you hold (e.g. a legacy bcrypt hash)
const legacy = credentialRecord("legacy", "$2b$10$……");

const store = new InMemoryUserManagementStore();
store.importUsers([rec, legacy]);          // no clear text involved
await store.authenticate("admin", "admin-pw1"); // -> Good
```

`serializeUser` / `exportUsers` records are interchangeable and, together with
`importUsers`, back the consolidated archive (see below). Records written by an
older release (raw `{salt, hash}`, archive **v1**) are migrated to a `$scrypt$`
credential on read — **no forced password resets**.

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
