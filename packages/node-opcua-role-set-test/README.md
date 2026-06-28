# node-opcua-role-set-test

Integration tests for OPC UA **RoleSet management** (OPC 10000-18 — *Role-Based Security*).

This is a **private, internal** package (`"private": true`) — it is not published to npm
and exposes no public API. It exists to exercise the `role-set-common`,
`role-set-server` and `role-set-client` packages together, end-to-end.

The tests run against an in-process `PseudoSession` over a real `AddressSpace`, so the
full server `installRoleSet` + client `ClientRole` round-trip is verified without
standing up an actual TCP server.

see http://node-opcua.github.io/

## What is covered

- **`browseRoles`** — the client discovers all well-known roles published in the server `RoleSet`.
- **`readAllRoleIdentities`** — identities are read back for every role (empty initially).
- **AddIdentity / RemoveIdentity round-trip** — an identity added to the server-side
  store is read back through the client, then removed and verified gone.
- **RoleSetResolver** — verifies that a registered resolver maps user identity tokens
  to the correct roles (Anonymous → Observer, UserName "admin" → SecurityAdmin, etc.).

## Layout

| File | Purpose |
|------|---------|
| `test/test_role_set_integration.ts` | Full server + client round-trip via `PseudoSession`. |
| `test/test_client_role_set.ts` | Client-only browse / read tests against the standard nodeset. |

## Running the tests

From the repository root:

```bash
$ npx lerna run test --scope node-opcua-role-set-test
```

or from within this package:

```bash
$ npm test
```

Type-check the tests without running them:

```bash
$ npm run test:check
```

## Related packages

- [`node-opcua-role-set-common`](../node-opcua-role-set-common) — shared types, identity stores and persistence.
- [`node-opcua-role-set-server`](../node-opcua-role-set-server) — server-side RoleSet installation and method binding.
- [`node-opcua-role-set-client`](../node-opcua-role-set-client) — client-side role browsing and identity management.

# License

Node-OPCUA is made available to you under the MIT open source license.

See [LICENSE](./LICENSE) for details.

# Copyright

Copyright (c) 2022-2026 Sterfive SAS - https://www.sterfive.com

Copyright (c) 2014-2022 Etienne Rossignon
