# Role-Based Security & User Management (OPC 10000-18)

NodeOPCUA ships a complete, modular, and spec-conformant implementation of **Role-Based Security** (RBAC) and **User Management** (OPC 10000-18) available in open source under the MIT license.

For a higher-level commercial overview of why this matters and how it fits into the OPC UA security landscape, see [OPC UA Role-Based Security in Practice](https://www.sterfive.com/en/blog/opcua-role-based-security-nodeopcua-2-174-0/) on the Sterfive blog.

---

## Overview

OPC 10000-18 (Part 18) defines the standard **Information Model** by which an OPC UA Server decides **who is allowed to do what** in its AddressSpace. It does not invent new permissions (which live in Part 3). Instead, it defines the plumbing that connects **identities** (who is connecting) to **Roles** (named buckets of privileges), plus a standard API to manage local users at runtime.

The NodeOPCUA implementation is spread across five packages:

| Package | Role |
|---------|------|
| [`node-opcua-role-set-common`](https://github.com/node-opcua/node-opcua/tree/master/packages/node-opcua-role-set-common) | Framework-agnostic building blocks: identity/user stores, the consolidated encrypted archive, X.509/UserName matching, well-known Role NodeIds. No dependency on the address space. |
| [`node-opcua-role-set-server`](https://github.com/node-opcua/node-opcua/tree/master/packages/node-opcua-role-set-server) | Server-side install: binds the `RoleSet` and `UserManagement` Methods, resolves a session's Roles, persists, and hardens the sensitive nodes. |
| [`node-opcua-role-set-client`](https://github.com/node-opcua/node-opcua/tree/master/packages/node-opcua-role-set-client) | Client-side API to browse Roles, read/modify their identities, and administer users over a real session. |
| [`node-opcua-role-set-admin`](https://github.com/node-opcua/node-opcua/tree/master/packages/node-opcua-role-set-admin) | The `role-set-admin` command-line tool, built on the client. |
| [`node-opcua-role-set-test`](https://github.com/node-opcua/node-opcua/tree/master/packages/node-opcua-role-set-test) | Integration tests + a runnable sample server (private). |

---

## Architecture

Part 18 decouples two core security concerns:
1. **Authentication ("Who are you?")**: Handled at session activation (Part 4) using user identity tokens (UserName, X.509 certificates, or JSON Web Tokens) and client application certificates.
2. **Authorization ("What may you do?")**: Enforced per-Node via `RolePermissions` granted to specific Roles (Part 3).

A session can hold **many Roles** simultaneously. The Server evaluates every Role's mapping rules against the session's properties (user credentials, application URI, endpoint URL, security level) and grants all Roles that match.

### Component Relationship

```
+-------------------------------------------------------------+
|                        OPC UA Client                        |
+-------------------------------------------------------------+
                               |
                         (OPC UA Message Channel)
                               v
+-------------------------------------------------------------+
|                        OPCUAServer                          |
|                                                             |
|  +---------------------+           +---------------------+  |
|  |       RoleSet       |           |   UserManagement    |  |
|  |  (AddIdentity, etc) |           |  (AddUser, Change)  |  |
|  +-----------+---------+           +----------+----------+  |
|              |                                |             |
|              v                                v             |
|  +-----------+--------------------------------+----------+  |
|  |                IManagedUserManager Bridge             |  |
|  +----------------------------+--------------------------+  |
|                               |                             |
|                               v                             |
|  +----------------------------+--------------------------+  |
|  |                       ArchiveStore                    |  |
|  |       (Consolidated on-disk, AES-256-GCM encrypted)   |  |
|  +-------------------------------------------------------+  |
+-------------------------------------------------------------+
```

To prevent data drift, the server core resolves a session's Roles through a single integration point: the server `userManager` bridge. Both the "legacy" session-creation path and the "modern" RoleSet Methods map to the same in-memory user and identity stores, backed by a single persistence file.

---

## Getting Started

The simplest way to configure a NodeOPCUA server with full Role-Based Security and User Management is using the `createRoleBasedSecurity` helper.

```typescript
import { OPCUAServer, MessageSecurityMode, SecurityPolicy } from "node-opcua";
import { WellKnownRoleIds } from "node-opcua-role-set-common";
import { createRoleBasedSecurity } from "node-opcua-role-set-server";

async function main() {
    // 1. Build the shared stores and the userManager bridge.
    // Seeds initial users and maps them to standard Roles.
    const security = createRoleBasedSecurity({
        policy: { minLength: 8, requireDigit: true },
        users: [
            {
                userName: "admin",
                password: "RotateMe1!",
                roles: [WellKnownRoleIds.SecurityAdmin, WellKnownRoleIds.ConfigureAdmin]
            },
            {
                userName: "operator",
                password: "ChangeMe!",
                roles: [WellKnownRoleIds.Operator, WellKnownRoleIds.Observer]
            }
        ]
    });

    // 2. The userManager is a constructor option, passed during server creation.
    const server = new OPCUAServer({
        port: 4840,
        securityModes: [MessageSecurityMode.SignAndEncrypt],
        securityPolicies: [SecurityPolicy.Basic256Sha256],
        userManager: security.userManager
    });

    await server.initialize();
    await server.start();

    // 3. Install the RoleSet and User Management Methods after start().
    // Binds the active stores and persists to an AES-256-GCM encrypted archive.
    await security.install(server, {
        persistencePath: "./config/role-set.json",
        persistenceSecret: process.env.ROLE_SET_SECRET // AES-256-GCM encryption key
    });
}

main().catch(console.error);
```

---

## API Reference

### `createRoleBasedSecurity(options?)`

Creates the user and identity mapping stores, builds the `userManager` bridge, and returns an installation helper.

* **Parameters**: `options?: CreateRoleBasedSecurityOptions`
  * `policy?: PasswordPolicy`: Enforced password complexity rules.
    * `minLength?: number`
    * `requireDigit?: boolean`
    * `requireUpperCase?: boolean`
    * `requireLowerCase?: boolean`
    * `requireSpecialCharacters?: boolean`
  * `users?: RoleBasedUser[]`: List of users to seed.
    * `userName: string`
    * `password: string`
    * `roles?: NodeId[]`
    * `userConfiguration?: UserConfigurationMask`
    * `description?: string`
* **Returns**: `RoleBasedSecurity`
  * `userStore: InMemoryUserManagementStore`
  * `identityStore: InMemoryIdentityMappingStore`
  * `userManager: IManagedUserManager`
  * `install(server, options)`: Binds Methods to the server and starts persistence.

### `installRoleSet(server, options)`

Lower-level server method to install the RoleSet information model independently.
* **Parameters**:
  * `server: IServerForRoleSet`
  * `options: InstallRoleSetOptions` (requires `store: IIdentityMappingStore` and `persistence: ArchiveStore`).

### `WellKnownRoles` & `WellKnownRoleIds`

`WellKnownRoles` defines the standard numeric identifiers. `WellKnownRoleIds` defines pre-built `NodeId` objects:
* `WellKnownRoleIds.Anonymous`
* `WellKnownRoleIds.AuthenticatedUser`
* `WellKnownRoleIds.Observer`
* `WellKnownRoleIds.Operator`
* `WellKnownRoleIds.Engineer`
* `WellKnownRoleIds.Supervisor`
* `WellKnownRoleIds.ConfigureAdmin`
* `WellKnownRoleIds.SecurityAdmin`

### `ClientRoleSet` & `ClientUserManagement`

Client-side classes (from `node-opcua-role-set-client`) for remote administration over an active OPC UA session.
* `ClientRoleSet`: exposes methods like `addRole`, `removeRole`, `addIdentity`, `removeIdentity`, `setApplications`, `setEndpoints`.
* `ClientUserManagement`: exposes methods like `addUser`, `modifyUser`, `removeUser`, `changePassword`.

### Flags and Masks

* **`UserConfigurationMask`**:
  * `None = 0`
  * `MustChangePassword = 1`
  * `NoDelete = 2`
  * `NoChangeByUser = 4`
  * `Disabled = 8`
* **`PasswordOptionsMask`**: Flags returned to clients to advertise complexity rules (`RequiresUpperCase`, `RequiresLowerCase`, `RequiresDigit`, `RequiresSpecialCharacters`).

---

## Identity Mapping Reference

Identity mapping rules are managed via the standard `AddIdentity` and `RemoveIdentity` Methods on each Role object. The system supports 9 criteria types (`IdentityCriteriaType`):

| Criteria Type | Description & Matching Logic |
|---|---|
| **`UserName`** | Matches a `UserNameIdentityToken` whose user name matches the rule criteria exactly. |
| **`Thumbprint`** | Matches an `X509IdentityToken` whose SHA-1 certificate thumbprint matches the criteria. |
| **`Role`** | Matches a token carrying a JWT whose `roles` array contains the criteria. |
| **`GroupId`** | Matches a token carrying a JWT whose `groups` array contains the criteria. |
| **`Anonymous`** | Evaluates to `true` when the session is anonymous. |
| **`AuthenticatedUser`** | Evaluates to `true` when any valid user credentials are provided. |
| **`Application`** | Matches a specific `ApplicationUri` from a trusted client certificate. |
| **`X509Subject`** | Matches an `X509IdentityToken` whose certificate subject matches the criteria. Supports full normalized DN matching (e.g. `CN="Jane Doe"/O="Sterfive"/C="FR"`). |
| **`TrustedApplication`** | Evaluates to `true` for any trusted client application connected over a signed/encrypted channel. |

---

## Security Model

The implementation adheres to strict security rules defined in the specification:
* **Administrative Isolation**: The management Methods (`AddRole`, `AddIdentity`, `AddUser`, etc.) require the caller to hold the `SecurityAdmin` Role and connect over an **encrypted channel** (`SignAndEncrypt`). Calls over unencrypted channels or from non-admin users fail with `Bad_SecurityModeInsufficient` or `Bad_UserAccessDenied`.
* **Browsable Hiding**: Sensitive configuration nodes (such as the `Identities`, `Applications`, and `Endpoints` properties of Roles, as well as the `Users` list) are hidden from Browse results for non-admin sessions.
* **Audit Trail**: Every modification to the roles, identity rules, or user database raises a `RoleMappingRuleChangedAuditEventType` event, providing a tamper-evident audit log that never exposes password credentials.
* **Active Disconnection**: Disabling or deleting a user immediately terminates all active sessions and subscriptions held by that user.
* **Self-Reference Protection**: A user cannot delete or disable their own account; doing so returns `Bad_InvalidSelfReference`.

---

## Persistence

All configuration data, which includes custom roles, identity mapping rules, application/endpoint filters, and users (stored using salted scrypt password hashes), is saved in a **single consolidated JSON or binary archive file**.
* **Atomic Writes**: Persistence uses a temp-file write followed by a rename to prevent file corruption in the event of a system crash.
* **Encryption at Rest**: If a `persistenceSecret` is provided, the archive is encrypted using AES-256-GCM. The key is derived from the secret using scrypt.

---

## Migration Guide

If you are migrating a server from a legacy, hand-rolled `userManager` authentication model:
1. **Bridge the Model**: Retain your legacy user database initially by wrapping it inside the `IManagedUserManager` bridge using a custom `IRoleResolver`.
2. **Convert Checkers**: Replace inline, code-based checks (e.g., `if (user.isAdmin)`) with declarative `RolePermissions` defined directly on the AddressSpace Nodes during initialization.
3. **Migrate Accounts**: Import your user accounts into the standard `UserManagement` store, ensuring passwords are converted into standard scrypt formats.
4. **Remove Legacy Code**: Decommission the legacy `userManager` once all permissions are declared in the address space.

---

## `role-set-admin` CLI Reference

The `role-set-admin` CLI tool allows remote administration of any conformant OPC UA server.

```bash
# Install globally
npm install -g node-opcua-role-set-admin

# List all Roles configured on the server
npx role-set-admin -e opc.tcp://localhost:4840 -u admin list-roles

# Map a UserName identity to the Operator Role
npx role-set-admin -e opc.tcp://localhost:4840 -u admin add-identity Operator alice

# Create a new local user and map to the Engineer Role
npx role-set-admin -e opc.tcp://localhost:4840 -u admin add-user bob s3cret-pw1 -r Engineer
```

---

## Troubleshooting & FAQ

* **`Bad_SecurityModeInsufficient`**: The client is attempting to call a management Method or read sensitive properties over an unencrypted channel. The channel must be switched to `SignAndEncrypt`.
* **`Bad_UserAccessDenied`**: The authenticated user does not have the `SecurityAdmin` Role required to run the operation.
* **`Good_PasswordChangeRequired`**: The user account has been flagged with `MustChangePassword`. The user's active session is restricted to `Anonymous` permissions until they call the `ChangePassword` Method.
* **`Bad_InvalidSelfReference`**: The admin user is attempting to delete or disable the account they are currently logged in with.

---

## Links and Resources

* **Commercial context and architectural rationale**: [Sterfive blog → OPC UA Role-Based Security in Practice](https://www.sterfive.com/en/blog/opcua-role-based-security-nodeopcua-2-174-0/)
* **Vendor-neutral spec walkthrough**: [Sterfive Learn → OPC UA Part 18](https://www.sterfive.com/en/learn/opcua-reference/role-based-security)
* **Official Release Notes**: [v2.174.0 on GitHub](https://github.com/node-opcua/node-opcua/releases/tag/v2.174.0)
* **Need enterprise support?**: [Sterfive, book a briefing](https://www.sterfive.com/en/contact)
