# Role-Based Security & User Management (OPC 10000-18)

NodeOPCUA ships a complete, modular implementation of **Role-Based Security**
and **User Management** (OPC 10000-18) spread across five packages:

| Package | Role |
|---------|------|
| [`node-opcua-role-set-common`](https://github.com/node-opcua/node-opcua/tree/master/packages/node-opcua-role-set-common) | Framework-agnostic building blocks — identity/user stores, the consolidated encrypted archive, X509/UserName matching, well-known Role NodeIds. No dependency on the address space. |
| [`node-opcua-role-set-server`](https://github.com/node-opcua/node-opcua/tree/master/packages/node-opcua-role-set-server) | Server-side install: binds the `RoleSet` and `UserManagement` Methods, resolves a session's Roles, persists, and hardens the sensitive nodes. |
| [`node-opcua-role-set-client`](https://github.com/node-opcua/node-opcua/tree/master/packages/node-opcua-role-set-client) | Client-side API to browse Roles, read/modify their identities, and administer users over a real session. |
| [`node-opcua-role-set-admin`](https://github.com/node-opcua/node-opcua/tree/master/packages/node-opcua-role-set-admin) | The `role-set-admin` command-line tool, built on the client. |
| [`node-opcua-role-set-test`](https://github.com/node-opcua/node-opcua/tree/master/packages/node-opcua-role-set-test) | Integration tests + a runnable sample server (private). |

## The single source of truth

The server core resolves a session's Roles through **one** integration point —
the server `userManager` (`getUserRoles` + `getIdentitiesForRole`). The mistake
to avoid is wiring the "legacy" `userManager` and the "modern" RoleSet Methods
to *different* stores: they then drift apart and a client sees one thing while
authorization enforces another.

`createRoleBasedSecurity` exists precisely to prevent that. It owns **one** user
store and **one** identity store and exposes them through the `userManager`
bridge, so role resolution, each Role's `Identities` Property, the
AddIdentity/AddUser Methods and persistence are all backed by the same two
stores. The two views can never diverge.

## Getting started

```ts
import { OPCUAServer } from "node-opcua";
import { WellKnownRoleIds } from "node-opcua-role-set-common";
import { createRoleBasedSecurity } from "node-opcua-role-set-server";

// 1. Build the shared stores + the userManager bridge, seeding initial users.
const security = createRoleBasedSecurity({
    policy: { minLength: 8, requireDigit: true },
    users: [
        { userName: "admin", password: "admin-pw1", roles: [WellKnownRoleIds.SecurityAdmin, WellKnownRoleIds.ConfigureAdmin] },
        { userName: "operator", password: "operator-pw1", roles: [WellKnownRoleIds.Operator, WellKnownRoleIds.Observer] }
    ]
});

// 2. The userManager is a *constructor* option (it is needed at login, before
//    the address space exists), so pass it when creating the server.
const server = new OPCUAServer({
    port: 4840,
    securityModes: [/* SignAndEncrypt */],
    userManager: security.userManager
});
await server.start();

// 3. Install the RoleSet + User Management Methods *after* start(), bound to the
//    same two stores, persisted into one consolidated (optionally encrypted) file.
await security.install(server, {
    persistencePath: "./config/role-set.json",
    persistenceSecret: process.env.ROLE_SET_SECRET // optional: AES-256-GCM at rest
});
```

A signed-in user is granted `AuthenticatedUser` automatically, on top of the
Roles mapped to their identity.

### Doing it by hand

If you do not want the one-call helper, install the two halves yourself and pass
them the **same** `ArchiveStore` and the **same** stores so they stay coordinated:

```ts
import { ArchiveStore, InMemoryIdentityMappingStore, InMemoryUserManagementStore } from "node-opcua-role-set-common";
import { installRoleSet, installUserManagement, createUserManager } from "node-opcua-role-set-server";

const identityStore = new InMemoryIdentityMappingStore();
const userStore = new InMemoryUserManagementStore();
const userManager = createUserManager(userStore, identityStore); // -> OPCUAServer constructor option

// after server.start():
const persistence = new ArchiveStore("./config/role-set.json", { secret: process.env.ROLE_SET_SECRET });
await installRoleSet(server, { store: identityStore, persistence });
await installUserManagement(server, { store: userStore, persistence });
```

Install order does not matter: each installer registers only the archive
sections it owns, and a section with no provider keeps its last-loaded value, so
neither installer clobbers the other.

## The security model

The implementation follows OPC 10000-18 and enforces it with the address space's
*own* mechanisms (RolePermissions + AccessRestrictions), so the checks run in the
core before any bound handler:

- **Administrative Methods require `SecurityAdmin` over an encrypted channel.**
  AddRole/RemoveRole, AddIdentity/RemoveIdentity, the application/endpoint
  restriction Methods, and AddUser/ModifyUser/RemoveUser return
  `Bad_UserAccessDenied` to a non-admin and `Bad_SecurityModeInsufficient` over a
  None/Sign channel. `ChangePassword` stays callable by any authenticated user
  (still over an encrypted channel).
- **Sensitive nodes are hidden from a non-admin's Browse** (§4.4.1). Each Role's
  `Identities` / `Applications` / `Endpoints` Properties and its configuration
  Methods, plus the `Users` list, carry SecurityAdmin-only RolePermissions, so
  they vanish from a non-admin's Browse and cannot be read. The Role nodes
  themselves stay browsable, so the RoleSet hierarchy is intact.
- **Identity/user data never crosses an unencrypted channel.** The same nodes
  require `EncryptionRequired`, so reads over None/Sign get
  `Bad_SecurityModeInsufficient`.
- **Disabling or removing a user terminates their live sessions** (§5.2.6-7), not
  just their ability to re-authenticate.
- **Variable-level RolePermissions are enforced** on Read/Write — see the sample
  server for Variables gated per Role.

## Persistence

The whole configuration — identity→Role mappings, custom Role definitions,
application/endpoint restrictions, and users (salted scrypt hashes, never clear
passwords) — lives in **one** consolidated archive. It is written atomically
(temp file + rename, so a crash never leaves a half-written file) and, when a
secret is supplied, encrypted at rest with AES-256-GCM (key derived via scrypt).
The format is versioned and rejected if newer than the running code understands.

## Administering a running server

Use the client API in process, or the `role-set-admin` CLI from a shell:

```bash
npx role-set-admin -e opc.tcp://host:4840 -u admin list-roles      # password prompted (hidden)
npx role-set-admin -e opc.tcp://host:4840 -u admin add-identity Operator joe
npx role-set-admin -e opc.tcp://host:4840 -u admin add-user alice s3cret-pw1 -r Operator
```

See each package's README for the full API, and
[`node-opcua-role-set-test`](https://github.com/node-opcua/node-opcua/tree/master/packages/node-opcua-role-set-test)
for a runnable sample server with Variables gated by per-Role RolePermissions.

# License

Node-OPCUA is made available to you under the MIT open source license.

# Copyright

Copyright (c) 2022-2026 Sterfive SAS — https://www.sterfive.com
