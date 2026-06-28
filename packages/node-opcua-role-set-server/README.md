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

const { store, resolver } = await installRoleSet(server, {
    persistencePath: "./config/role-identities.bin"
});
```

What `installRoleSet` does:

1. Finds the `RoleSet` node (`i=15606`) in the address space.
2. Creates an `InMemoryIdentityMappingStore`, optionally loading persisted state from `persistencePath`.
3. Registers a `RoleSetResolver` on `server.roleResolvers` so sessions are mapped to roles at login.
4. For each Role in the RoleSet:
   - sets the initial `Identities` property value from the store;
   - binds the `AddIdentity` / `RemoveIdentity` methods (when present).
5. Binds `RoleSet.AddRole` / `RoleSet.RemoveRole` as `BadNotImplemented` stubs (custom roles are not supported).
6. After every mutation, refreshes the Role identity variables and (if configured) saves the store to disk.

### Returned values

| Field | Type | Description |
|-------|------|-------------|
| `store` | `IIdentityMappingStore` | The identity-mapping store backing the RoleSet. |
| `resolver` | `RoleSetResolver` | The resolver registered on `server.roleResolvers`. |

You can mutate `store` directly (e.g. to seed default mappings); call sites that go
through the bound methods automatically persist, but direct store changes need a manual
`saveToBinaryFile` if you want them persisted.

## Exports

| Export | Description |
|--------|-------------|
| `installRoleSet(server, options?)` | One-call setup of RoleSet management on a server. |
| `InstallRoleSetOptions` | `{ persistencePath?: string }`. |
| `InstallRoleSetResult` | `{ store, resolver }`. |
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
| `BadNotImplemented` | `AddRole` / `RemoveRole` — adding/removing custom roles is not supported. |

## Persistence

When `persistencePath` is supplied:

- existing mappings are loaded from the binary file on install (a missing file is a no-op);
- the store is re-saved after every successful `AddIdentity` / `RemoveIdentity` call.

The binary format is defined in [`node-opcua-role-set-common`](../node-opcua-role-set-common).

## Related packages

- [`node-opcua-role-set-common`](../node-opcua-role-set-common) — shared types, identity stores and persistence.
- [`node-opcua-role-set-client`](../node-opcua-role-set-client) — client-side role browsing and identity management.

# License

Node-OPCUA is made available to you under the MIT open source license.

See [LICENSE](./LICENSE) for details.

# Copyright

Copyright (c) 2022-2026 Sterfive SAS - https://www.sterfive.com

Copyright (c) 2014-2022 Etienne Rossignon
