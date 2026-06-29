# node-opcua-role-set-admin

A small command-line tool to administer the **RoleSet** and **User Management**
(OPC 10000-18) of any OPC UA server, built on
[`node-opcua-role-set-client`](../node-opcua-role-set-client). It connects over a
real session and drives the standard Methods, so it works against any compliant
server.

## Install

```bash
npm install -g node-opcua-role-set-admin
```

This installs the `role-set-admin` command.

## Usage

```bash
role-set-admin -e opc.tcp://host:4840 -u admin -p ***  list-roles
role-set-admin -e opc.tcp://host:4840 -u admin          show-role Operator   # password prompted
role-set-admin -e ... -u admin -p *** add-identity Operator joe
role-set-admin -e ... -u admin -p *** add-user alice s3cret -r Operator
role-set-admin -e ... -u admin -p *** remove-user alice
```

By default it connects with **SignAndEncrypt / Basic256Sha256** (most management
Methods require an encrypted channel and the `SecurityAdmin` Role). Use
`--insecure` for `None/None`.

If `--password` is omitted (but `--username` is given), the password is read from
the terminal with **hidden input** — so it never lands in your shell history or
the process list.

### Global options

| Option | Description |
|--------|-------------|
| `-e, --endpoint <url>` | OPC UA endpoint (required), e.g. `opc.tcp://host:4840`. |
| `-u, --username <name>` | User name (omit for anonymous). |
| `-p, --password <pw>` | Password (prompted with hidden input if omitted). |
| `--insecure` | Connect without security (`None/None`). |

### Commands

| Command | Description |
|---------|-------------|
| `list-roles` | List all Roles and their identities. |
| `show-role <name>` | Show one Role's identities. |
| `add-role <name>` | Add a custom Role. |
| `remove-role <name>` | Remove a custom Role. |
| `add-identity <role> <user>` | Map a UserName to a Role. |
| `remove-identity <role> <user>` | Unmap a UserName from a Role. |
| `list-users` | List managed users. |
| `add-user <user> <password> [-r <role...>]` | Add a user, optionally granting Roles. |
| `remove-user <user>` | Remove a user. |
| `change-password <old> <new>` | Change the connected user's password. |

## Programmatic API

The command actions are also exported, so you can script the same administration:

```ts
import { addIdentity, listRoles } from "node-opcua-role-set-admin";

await listRoles({ endpoint: "opc.tcp://host:4840", username: "admin", password: "***" });
await addIdentity({ endpoint, username: "admin", password: "***" }, "Operator", "joe");
```

## Related packages

- [`node-opcua-role-set-client`](../node-opcua-role-set-client) — client-side RoleSet/UserManagement API.
- [`node-opcua-role-set-server`](../node-opcua-role-set-server) — server-side install & enforcement.
- [`node-opcua-role-set-common`](../node-opcua-role-set-common) — shared stores, persistence, matching.
- [Role-Based Security & User Management guide](https://github.com/node-opcua/node-opcua/blob/master/documentation/role_based_security.md) — cross-package overview & getting started.

# License

Node-OPCUA is made available to you under the MIT open source license.

See [LICENSE](./LICENSE) for details.

# Copyright

Copyright (c) 2022-2026 Sterfive SAS - https://www.sterfive.com

Copyright (c) 2014-2022 Etienne Rossignon
