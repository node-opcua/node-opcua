# node-opcua-role-set-client

Client-side helpers for managing OPC UA **Roles** (OPC 10000-18 — *Role-Based Security*).

This package lets an OPC UA client discover the Roles published by a Server in its
`RoleSet` object, read the identities currently mapped to each Role, and call the
`AddIdentity` / `RemoveIdentity` methods on a Role.

It works against any session that implements `IBasicSessionAsync` — a real
`ClientSession`, a `PseudoSession` (in-process), or any compatible session — and
resolves the Role method/property NodeIds via `translateBrowsePath`, so no hard-coded
NodeIds are required.

see http://node-opcua.github.io/

## Installation

```bash
$ npm install node-opcua-role-set-client
```

## Exports

| Export | Description |
|--------|-------------|
| `browseRoles(session)` | Browse the server `RoleSet` and return the NodeId + name of every Role. |
| `readAllRoleIdentities(session)` | Read the identities mapped to every Role in the RoleSet. |
| `ClientRole` | Wrapper around a single Role node (read / add / remove identities). |
| `RoleIdentitiesResult` | `{ roleNodeId, roleName, identities }` returned by `readAllRoleIdentities`. |

## Browsing the available roles

```ts
import { OPCUAClient } from "node-opcua-client";
import { browseRoles } from "node-opcua-role-set-client";

const client = OPCUAClient.create({});
await client.withSessionAsync("opc.tcp://localhost:4840", async (session) => {
    const roles = await browseRoles(session);
    for (const { roleNodeId, roleName } of roles) {
        console.log(roleName, roleNodeId.toString());
    }
    // -> Anonymous, AuthenticatedUser, Observer, Operator,
    //    Engineer, Supervisor, ConfigureAdmin, SecurityAdmin, ...
});
```

## Reading identities of all roles

```ts
import { readAllRoleIdentities } from "node-opcua-role-set-client";

const results = await readAllRoleIdentities(session);
for (const { roleName, identities } of results) {
    console.log(roleName, "->", identities.map((i) => i.criteria));
}
```

## Working with a single role

`ClientRole` resolves the `AddIdentity`, `RemoveIdentity` and `Identities`
NodeIds on first use, then caches them.

```ts
import { ClientRole } from "node-opcua-role-set-client";
import { IdentityCriteriaType, IdentityMappingRuleType } from "node-opcua-types";

const roles = await browseRoles(session);
const secAdmin = roles.find((r) => r.roleName === "SecurityAdmin")!;

const role = new ClientRole(session, secAdmin.roleNodeId);

// read the current identities
const current = await role.readIdentities();

// grant the role to user "admin"
const rule = new IdentityMappingRuleType({
    criteriaType: IdentityCriteriaType.UserName,
    criteria: "admin"
});
const addResult = await role.addIdentity(rule);
if (addResult.statusCode.isNotGood()) {
    throw new Error("AddIdentity failed: " + addResult.statusCode.toString());
}

// ...and later revoke it
await role.removeIdentity(rule);
```

### `ClientRole` API

| Method | Description |
|--------|-------------|
| `readIdentities(): Promise<IdentityMappingRuleType[]>` | Read the `Identities` property of the Role. |
| `addIdentity(rule): Promise<CallMethodResult>` | Call the Role's `AddIdentity` method. |
| `removeIdentity(rule): Promise<CallMethodResult>` | Call the Role's `RemoveIdentity` method. |

> `addIdentity` / `removeIdentity` throw if the corresponding Method is not
> exposed by the Role; modifying the RoleSet typically requires a session
> authenticated with sufficient privileges (e.g. `SecurityAdmin`).

## Related packages

- [`node-opcua-role-set-common`](../node-opcua-role-set-common) — shared types, identity stores and persistence.
- [`node-opcua-role-set-server`](../node-opcua-role-set-server) — server-side RoleSet installation and method binding.

# License

Node-OPCUA is made available to you under the MIT open source license.

See [LICENSE](./LICENSE) for details.

# Copyright

Copyright (c) 2022-2026 Sterfive SAS - https://www.sterfive.com

Copyright (c) 2014-2022 Etienne Rossignon
