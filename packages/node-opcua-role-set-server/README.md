# node-opcua-role-set-server

Server-side **RoleSet management** for OPC UA (OPC 10000-18 — *Role-Based Security*).

This package wires the `RoleSet` object of an OPC UA server to an identity-mapping
store. It binds the `AddIdentity` / `RemoveIdentity` methods on each Role, keeps each
Role's `Identities` property in sync with the store, registers a role resolver that
maps incoming user identity tokens to roles, and optionally persists the mappings to
disk.

It builds on [`node-opcua-role-set-common`](../node-opcua-role-set-common) for the
store, persistence and well-known role NodeIds.

see http://node-opcua.github.io/

## Installation

```bash
$ npm install node-opcua-role-set-server
```

## Quick start

Call `installRoleSet` **after** the server has started, when the address space is
available:

```ts
import { OPCUAServer } from "node-opcua";
import { installRoleSet } from "node-opcua-role-set-server";

const server = new OPCUAServer({ /* ... */ });
await server.start();

const { store, restrictionStore, resolver } = await installRoleSet(server, {
    persistencePath: "./config/role-set.json",
    persistenceSecret: process.env.ROLE_SET_SECRET // optional: encrypt at rest
});
```

What `installRoleSet` does:

1. Finds the `RoleSet` node (`i=15606`) in the address space.
2. Loads the whole configuration from the consolidated archive at `persistencePath` (if any):
   identity mappings, custom Role definitions and application/endpoint restrictions.
3. Registers a `RoleSetResolver` on `server.roleResolvers` so sessions are mapped to roles at login.
4. For each Role in the RoleSet:
   - sets the initial `Identities` (and restriction) property values from the stores;
   - binds the `AddIdentity` / `RemoveIdentity` and the application/endpoint restriction methods.
5. Binds `RoleSet.AddRole` / `RoleSet.RemoveRole` (§4.2): custom Roles are created as
   `ns=1;g=<uuid>` instances of `RoleType` (collision-proof, stable across restarts);
   well-known Roles cannot be removed.
6. After every mutation, refreshes the Role variables and atomically rewrites the archive.

### Returned values

| Field | Type | Description |
|-------|------|-------------|
| `store` | `IIdentityMappingStore` | The identity-mapping store backing the RoleSet. |
| `restrictionStore` | `IRoleRestrictionStore` | The per-Role application/endpoint restriction store. |
| `resolver` | `RoleSetResolver` | The resolver registered on `server.roleResolvers`. |

You can mutate `store` directly (e.g. to seed default mappings); call sites that go
through the bound methods automatically persist, but direct store changes are not
written to the archive until the next method-driven mutation.

## Exports

| Export | Description |
|--------|-------------|
| `installRoleSet(server, options?)` | One-call setup of RoleSet management on a server. |
| `InstallRoleSetOptions` | `{ persistencePath?: string, persistenceSecret?: string }`. |
| `InstallRoleSetResult` | `{ store, restrictionStore, resolver }`. |
| `IServerForRoleSet` | Minimal server shape required (`roleResolvers` + `engine.addressSpace`). |
| `RoleSetResolver` | Adapts an `IIdentityMappingStore` to the server's `IRoleResolver` contract. |
| `makeAddIdentityHandler(options)` / `makeRemoveIdentityHandler(options)` | Build the method handlers (used internally; exposed for custom binding). |
| `addRoleNotImplemented` / `removeRoleNotImplemented` | `BadNotImplemented` stubs for `AddRole` / `RemoveRole`. |
| `BindRoleMethodsOptions` | `{ store, onMutation? }` passed to the handler factories. |

## Security

The `AddIdentity` and `RemoveIdentity` method handlers require the calling session to
hold the **`SecurityAdmin`** role; otherwise they return `BadUserAccessDenied`. Other
status codes returned by the handlers:

| Status | Condition |
|--------|-----------|
| `Good` | The identity was added / removed. |
| `BadUserAccessDenied` | The session does not hold the `SecurityAdmin` role. |
| `BadInvalidArgument` | The input argument is not an `IdentityMappingRuleType`. |
| `BadNoMatch` | `RemoveIdentity` — no matching rule was found. |
| `BadAlreadyExists` | `AddRole` — the RoleName duplicates an existing (well-known or custom) Role. |
| `BadRequestNotAllowed` | `RemoveRole` — well-known Roles cannot be removed. |

## Persistence

When `persistencePath` is supplied, the **entire** RoleSet configuration is kept in a
single consolidated archive (identity mappings, custom Role definitions and
application/endpoint restrictions):

- the archive is loaded on install (a missing file is a no-op);
- it is **atomically** rewritten (temp file + rename) after every successful mutation, so
  a crash can never leave a half-written file;
- when `persistenceSecret` is set the whole payload is encrypted at rest with AES-256-GCM
  (key derived from the secret via scrypt); otherwise it is plain, human-readable JSON
  with the identity mappings embedded as a base64 binary blob.

The archive format (`readArchive` / `writeArchive`, version-checked) is defined in
[`node-opcua-role-set-common`](../node-opcua-role-set-common).

### Sharing the archive with User Management

To keep **users** (salted scrypt hashes, never clear passwords) in the *same* file as the
role configuration, create one `ArchiveStore` and pass it to both installers — role set
**first**, then user management, before serving requests:

```ts
import { ArchiveStore } from "node-opcua-role-set-common";

const persistence = new ArchiveStore("./config/role-set.json", {
    secret: process.env.ROLE_SET_SECRET // optional encryption
});
await installRoleSet(server, { persistence });
await installUserManagement(server, { persistence });
```

The coordinator gathers every registered section (identities / roles / restrictions / users)
and rewrites the one file atomically on each mutation, so neither installer clobbers the
other. Pass only `persistencePath` instead for a role-config-only (or users-only) file.

## Related packages

- [`node-opcua-role-set-common`](../node-opcua-role-set-common) — shared types, identity stores and persistence.
- [`node-opcua-role-set-client`](../node-opcua-role-set-client) — client-side role browsing and identity management.

# License

Node-OPCUA is made available to you under the MIT open source license.

See [LICENSE](./LICENSE) for details.

# Copyright

Copyright (c) 2022-2026 Sterfive SAS - https://www.sterfive.com

Copyright (c) 2014-2022 Etienne Rossignon
