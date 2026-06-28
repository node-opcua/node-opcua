# RoleSet & User Management — End-to-End Scenarios (OPC 10000-18)

Spec-driven (Background / Given / When / Then) catalogue of real-life scenarios for
OPC UA Role-Based Security and User Management, derived from
[OPC 10000-18 v1.05.06](../../../opcua-specs/opcua-reference/OPC-10000-18/OPC-10000-18.md).

It serves two purposes:

1. **Gap analysis** — what the current `node-opcua-role-set-*` packages do and do not cover.
2. **Test backlog** — an exhaustive set of e2e scenarios to drive the implementation.

> **Testing approach.** The integration tests
> ([test_role_set_integration.ts](./test/test_role_set_integration.ts)) drive the
> **`ClientRoleSet`** client against the **server aggregator** (`installRoleSet` + a
> store-backed role resolver) over an in-process `PseudoSession`. No test touches the
> address space, a `UAObject` or a `UAVariable` directly — all role interaction goes
> through the client, exactly as an application would. The
> `SessionContext` simulates the calling user and the SecureChannel security mode,
> so authorization and the encrypted-channel requirement are exercised for real —
> the same client code path works against a remote `ClientSession`. This is the
> single, unified way to interact with both a live server and an in-process
> address space.

## Legend

| Mark | Meaning |
|------|---------|
| ✅ | Behaviour exists and is exercised by current tests |
| ⚠️ | Partially implemented / simplified / untested edge |
| ❌ | Not implemented — gap |

---

## Coverage summary

| Area | Spec | Status | Notes |
|------|------|--------|-------|
| Browse RoleSet, read Identities (client) | §4.3 / §4.4 | ✅ | `browseRoles`, `ClientRole.readIdentities` |
| AddIdentity / RemoveIdentity (happy path) | §4.4.5 / §4.4.6 | ✅ | store-backed handlers |
| SecurityAdmin authorization | §4.4.5 | ✅ | `checkSecurityAdminAccess` |
| **Encrypted-channel enforcement** | §4.4.1, all methods | ✅ | `Bad_SecurityModeInsufficient` enforced in AddIdentity/RemoveIdentity; unit-tested **and** integration-tested client→server over a PseudoSession whose context simulates the channel security mode; not yet on read/browse |
| Identity criteria: Anonymous / AuthenticatedUser / UserName | §4.4.4 | ✅ | |
| Identity criteria: Thumbprint | §4.4.4 | ⚠️ | SHA-1 thumbprint matched; not e2e tested |
| Identity criteria: X509Subject | §4.4.4 | ✅ | full ordered DN format (Table 10) + legacy CN; unit-tested |
| Identity criteria: TrustedApplication (9) | §4.4.4 | ❌ | not handled; role not in RoleSet either |
| Identity criteria: Application (7) | §4.4.4 | ❌ | |
| Identity criteria: Role (3) / GroupId (4) — JWT | §4.4.4 | ❌ | |
| `Bad_AlreadyExists` on duplicate identity | §4.4.5 | ✅ | handler returns Bad_AlreadyExists; unit-tested |
| `Bad_RequestNotAllowed` (e.g. Anonymous on admin role) | §4.4.5 | ✅ | weak rules refused on SecurityAdmin/ConfigureAdmin; unit-tested |
| Re-evaluate roles on **active** sessions after change | §4.4.1 | ✅ | roles are recomputed per request (not cached), so a mapping change takes effect on an already-active session without reconnecting; integration-tested |
| Well-known role immutability (Anonymous/Auth/TrustedApp) | §4.3 | ⚠️ | Anonymous/AuthenticatedUser enforced; TrustedApplication absent from build |
| AddRole / RemoveRole | §4.2.2 / §4.2.3 | ✅ | custom Roles created as `ns=1;g=<uuid>` (persisted), RoleName unique across all namespaces (rejects well-known/custom name clashes), well-known Roles cannot be removed; driven via `ClientRoleSet.addRole`/`removeRole`/`getRoleByNodeId`, client-integration-tested. (Spec's "reuse well-known NodeId" path is intentionally replaced by impersonation rejection.) |
| Applications / ApplicationsExclude + Add/RemoveApplication | §4.4.1, §4.4.7-8 | ❌ | |
| Endpoints / EndpointsExclude + Add/RemoveEndpoint | §4.4.1, §4.4.9-10 | ❌ | |
| CustomConfiguration | §4.4.1 | ❌ | |
| Browse/read of sensitive role data restricted to admins | §4.4.1 | ❌ | |
| RoleMappingRuleChangedAuditEventType | §4.5 | ❌ | no audit event raised |
| Persistence across restart | — (impl) | ✅ | `installRoleSet` loads persisted identities on startup; tested in `test_install_role_set.ts` and used to bootstrap the integration tests |
| **User Management (AddUser/ModifyUser/RemoveUser)** | §5.2 | ✅ | `installUserManagement` binds the UA `UserManagement` Methods; driven via `ClientUserManagement` and integration-tested over a PseudoSession |
| **ChangePassword** | §5.2.8 | ✅ | bound to the UA Method; client integration test proves old-fails/new-works, USERNAME-token & encrypted-channel gating |
| MustChangePassword / Good_PasswordChangeRequired flow | §5.2.8 | ✅ | proven over a **real OPCUAServer**: ActivateSession returns `Good_PasswordChangeRequired`, the **client detects it** via `sessionRequiresPasswordChange(session)` (no server/userManager access), restricted to Anonymous, password rotated in-session, old rejected, new accepted |
| Password policy (length / options mask) | §5.2.1-2 | ⚠️ | `PasswordPolicy` validated in store + published via `PasswordLength`/`PasswordOptions`; unit-tested |
| User disable / NoDelete / NoChangeByUser | §5.2.3 | ✅ | enforced in store + unit-tested; a disabled user can no longer activate a session (real-server e2e); proactive session-close on disable still pending |
| Bad_InvalidSelfReference (disable/remove self) | §5.2.6-7 | ✅ | enforced in store + handlers; client integration-tested (RemoveUser self) |

---

# Feature: Secure channel enforcement for Role configuration

> §4.4.1 — *"The Properties and Methods of the RoleType contain sensitive security
> related information and shall only be browseable, readable, writeable and callable
> by authorized administrators through an encrypted channel."*
> Every config Method lists `Bad_SecurityModeInsufficient`.

**Background:**
- Given an OPC UA server with RoleSet management installed
- And the `SecurityAdmin` role is mapped to user `"admin"`

### Scenario: AddIdentity rejected over an unencrypted channel ⚠️ *(handler unit-tested)*
- Given a client connected with `SecurityMode = None`
- And the session is authenticated as `"admin"` (SecurityAdmin)
- When the client calls `AddIdentity` on the `Operator` role
- Then the call returns `Bad_SecurityModeInsufficient`
- And the RoleSet is unchanged

### Scenario: AddIdentity rejected for `Sign`-only channel if server requires encryption ⚠️ *(handler unit-tested)*
- Given a client connected with `SecurityMode = Sign`
- When `"admin"` calls `AddIdentity`
- Then the call returns `Bad_SecurityModeInsufficient`

### Scenario: AddIdentity accepted over `SignAndEncrypt` ✅
- Given a client connected with `SecurityMode = SignAndEncrypt`
- And the session is authenticated as `"admin"`
- When `"admin"` calls `AddIdentity` with a valid rule
- Then the call returns `Good`

### Scenario: Reading the `Identities` property over an unencrypted channel is denied ❌
- Given a client connected with `SecurityMode = None`
- When the client reads the `Identities` property of any Role
- Then the read returns `Bad_SecurityModeInsufficient` (or `Bad_UserAccessDenied`)

### Scenario: Browsing Role config Methods is hidden from non-admin sessions ❌
- Given an anonymous session over an encrypted channel
- When the client browses the `SecurityAdmin` role
- Then the `AddIdentity` / `RemoveIdentity` methods are not returned (or not callable)

---

# Feature: Authorization of Role configuration

**Background:**
- Given a server with RoleSet management over an encrypted channel
- And `SecurityAdmin` is mapped to `"admin"`

### Scenario: Non-admin cannot add an identity ✅
- Given a session authenticated as `"operator"` (no SecurityAdmin)
- When the session calls `AddIdentity`
- Then the call returns `Bad_UserAccessDenied`

### Scenario: Anonymous cannot add an identity ✅
- Given an anonymous session
- When it calls `AddIdentity`
- Then the call returns `Bad_UserAccessDenied`

### Scenario: Admin can add and remove an identity ✅
- Given a session authenticated as `"admin"`
- When it calls `AddIdentity` then `RemoveIdentity` with the same rule
- Then both calls return `Good`

---

# Feature: Identity-to-Role mapping at session activation

> §4.4.1 — A Role is granted to a Session only if the UserIdentityToken complies
> with `Identities` (and Applications/Endpoints, if configured).

**Background:**
- Given a server with the well-known RoleSet installed

### Scenario: Anonymous session receives the Anonymous role ✅
- Given the `Anonymous` role has an `Anonymous` identity rule (default)
- When a client activates a session with an `AnonymousIdentityToken`
- Then the session holds the `Anonymous` role
- And does not hold `Operator` or `SecurityAdmin`

### Scenario: Authenticated user receives AuthenticatedUser role ✅
- Given the `AuthenticatedUser` role has an `AuthenticatedUser` rule (default)
- When a client activates with a valid `UserName` token
- Then the session holds `AuthenticatedUser`

### Scenario: UserName mapping grants the configured role ✅
- Given `Operator` has a `UserName="joe"` identity rule
- When `"joe"` activates a session
- Then the session holds the `Operator` role
- And `"jane"` activating does not hold `Operator`

### Scenario: Thumbprint mapping grants role to a certificate user ⚠️
- Given `Engineer` has a `Thumbprint=<SHA1 hex upper, no spaces>` rule
- When a client activates with an `X509IdentityToken` whose cert thumbprint matches
- Then the session holds `Engineer`
- And a different certificate does not

### Scenario: X509Subject mapping using full ordered DN ✅ *(matching unit-tested)*
- Given `Supervisor` has an `X509Subject = CN="Jane Doe"/O="ACME"` rule
- When Jane Doe's certificate (CN=Jane Doe, O=ACME) is used
- Then the session holds `Supervisor`
- And a cert matching only CN but not O does **not** grant the role

### Scenario: TrustedApplication criteria ❌
- Given a role has a `TrustedApplication` rule
- When a client with a trusted ApplicationInstance certificate connects over a signed channel
- Then the session holds that role
- And a client whose certificate is not trusted does not

### Scenario: Application criteria (ApplicationUri) ❌
- Given a role has an `Application = "urn:acme:scada"` rule
- When a client whose certificate ApplicationUri is `urn:acme:scada` connects over a signed channel
- Then the session holds the role

### Scenario: A session may hold multiple roles ⚠️
- Given `"admin"` matches both `AuthenticatedUser` and `SecurityAdmin` rules
- When `"admin"` activates
- Then the session holds both roles (no duplicates)

### Scenario: Unmatched token grants only the default Anonymous role ✅
- Given no rule matches `"ghost"`
- When `"ghost"` activates with a valid token
- Then the session holds only `AuthenticatedUser` (the default) and not the others

---

# Feature: Live re-evaluation of Role assignment

> §4.4.1 — *"If the configuration of a Role is changed, the Role assignment to active
> Session shall be re-evaluated and applied."*

**Background:**
- Given an encrypted admin session and a separate operator session

### Scenario: Granting a role takes effect on an active session ✅ *(integration-tested)*
- Given user `"ivan"` has an active session that is denied configuring roles
- When `"admin"` adds a `UserName="ivan"` rule to the `SecurityAdmin` role
- Then `"ivan"`'s existing session is re-evaluated and now holds `SecurityAdmin`
- And `"ivan"` can now configure roles **without reconnecting**

### Scenario: Revoking a role takes effect on an active session ✅ *(integration-tested)*
- Given `"ivan"`'s active session holds `SecurityAdmin`
- When `"admin"` removes the `UserName="ivan"` rule
- Then `"ivan"`'s session no longer holds `SecurityAdmin`
- And a subsequent configuration call returns `Bad_UserAccessDenied`

---

# Feature: AddIdentity / RemoveIdentity rule lifecycle

**Background:**
- Given an encrypted admin session

### Scenario: Add then read back the identity via client ✅
- When `"admin"` adds `UserName="bob"` to `SecurityAdmin`
- Then `ClientRole.readIdentities()` for `SecurityAdmin` returns that rule

### Scenario: Adding a duplicate identity returns Bad_AlreadyExists ✅ *(handler unit-tested)*
- Given `Operator` already has `UserName="bob"`
- When `"admin"` adds `UserName="bob"` again
- Then the call returns `Bad_AlreadyExists`

### Scenario: Removing a non-existent rule returns Bad_NotFound ✅
- When `"admin"` removes a rule that was never added
- Then the call returns `Bad_NotFound` (`BadNoMatch` in current impl)

### Scenario: Invalid argument is rejected ✅
- When `"admin"` calls `AddIdentity` with a non-`IdentityMappingRuleType` argument
- Then the call returns `Bad_InvalidArgument`

### Scenario: Server refuses an Anonymous rule on an administrative role ✅ *(handler unit-tested)*
> §4.4.5 — *"a Server should refuse to allow an ANONYMOUS_5 mapping rule to be
> added to Roles with administrator privileges."*
- When `"admin"` adds an `Anonymous` rule to `SecurityAdmin`
- Then the call returns `Bad_RequestNotAllowed`

---

# Feature: Well-known Role immutability

> §4.3 — *"A Server shall not allow changes to the Roles Anonymous, AuthenticatedUser
> and TrustedApplication"* and shall not allow their deletion.

### Scenario: Cannot modify the Anonymous role ✅ *(handler unit-tested)*
- Given an encrypted admin session
- When `"admin"` calls `AddIdentity` on the `Anonymous` role
- Then the call returns `Bad_RequestNotAllowed`

### Scenario: Cannot remove a well-known immutable role ❌
- When `"admin"` calls `RemoveRole` for `AuthenticatedUser`
- Then the call returns `Bad_RequestNotAllowed`

---

# Feature: Custom Role management (AddRole / RemoveRole)

> §4.2.2 / §4.2.3 — currently bound as `Bad_NotImplemented` stubs.

**Background:**
- Given an encrypted admin session

### Scenario: Add a new custom role ❌
- When `"admin"` calls `AddRole("Maintenance", "urn:acme")`
- Then the call returns `Good` with a new `RoleNodeId`
- And the new role appears in the RoleSet with a `RoleType` definition

### Scenario: Adding a duplicate role fails ❌
- Given a role `Maintenance` already exists
- When `"admin"` calls `AddRole("Maintenance", "urn:acme")`
- Then the call returns `Bad_AlreadyExists`

### Scenario: Add a well-known role by canonical name/namespace ❌
- When `"admin"` calls `AddRole("Observer", "http://opcfoundation.org/UA/")`
- Then the server reuses the well-known `Observer` NodeId

### Scenario: AddRole over unencrypted channel ❌
- Given an unencrypted channel
- When `AddRole` is called
- Then it returns `Bad_SecurityModeInsufficient`

### Scenario: Remove a custom role deletes its permissions ❌
- Given custom role `Maintenance` grants write on node `X`
- When `"admin"` calls `RemoveRole(MaintenanceNodeId)`
- Then the call returns `Good`
- And sessions that held `Maintenance` lose the write permission on `X`

### Scenario: Removing an unknown role fails ❌
- When `"admin"` calls `RemoveRole` with an unknown NodeId
- Then the call returns `Bad_NodeIdUnknown`

---

# Feature: Application-based restrictions

> §4.4.1, §4.4.7-8 — `Applications` / `ApplicationsExclude` and Add/RemoveApplication.

**Background:**
- Given an encrypted admin session and a role `Operator`

### Scenario: Include list restricts role to listed applications ❌
- Given `Operator` has `ApplicationsExclude=false` and `Applications=["urn:acme:hmi"]`
- And `Operator` has a `UserName="joe"` rule
- When `"joe"` connects from application `urn:acme:hmi` (signed channel)
- Then the session holds `Operator`
- And `"joe"` connecting from `urn:other:app` does **not** hold `Operator`

### Scenario: Exclude list blocks listed applications ❌
- Given `Operator` has `ApplicationsExclude=true` and `Applications=["urn:evil:app"]`
- When `"joe"` connects from `urn:evil:app`
- Then the session does not hold `Operator`
- And `"joe"` from any other application does

### Scenario: Applications entries require a signed channel ❌
- Given `Operator.Applications` is non-empty
- When a client connects with `SecurityMode=None`
- Then the role is not granted (signed/encrypted required)

### Scenario: AddApplication duplicate / unknown ❌
- When `"admin"` calls `AddApplication` twice with the same URI → second returns `Bad_AlreadyExists`
- When `"admin"` calls `RemoveApplication` for an unlisted URI → returns `Bad_NotFound`

---

# Feature: Endpoint-based restrictions

> §4.4.1, §4.4.9-10 — `Endpoints` / `EndpointsExclude` and Add/RemoveEndpoint.

**Background:**
- Given a server exposing endpoints `A` (SignAndEncrypt) and `B` (None)

### Scenario: Role limited to a specific endpoint ❌
- Given `Engineer` has `EndpointsExclude=false` and `Endpoints=[{endpointUrl: A, securityMode: SignAndEncrypt}]`
- And `Engineer` maps `UserName="eng"`
- When `"eng"` connects through endpoint `A`
- Then the session holds `Engineer`
- And `"eng"` connecting through endpoint `B` does not

### Scenario: Default-valued EndpointType fields are ignored in comparison ❌
- Given an `Endpoints` entry sets only `endpointUrl` (securityMode = Invalid)
- When matching a session
- Then only the URL is compared (mode/policy/transport ignored)

---

# Feature: Combined identity + application + endpoint criteria

> §4.4.1 — A role is granted only when **all** configured conditions match.

### Scenario: All three conditions must hold ❌
- Given `Operator` requires `UserName="joe"` AND `Applications=["urn:acme:hmi"]` AND endpoint `A`
- When `"joe"` from `urn:acme:hmi` through endpoint `A` connects
- Then the session holds `Operator`
- And failing any single condition denies the role

---

# Feature: Audit events on Role configuration change

> §4.5 — `RoleMappingRuleChangedAuditEventType` raised on any Add/Remove method.

### Scenario: AddIdentity raises an audit event ❌
- Given a client subscribed to the server audit events
- When `"admin"` successfully calls `AddIdentity`
- Then a `RoleMappingRuleChangedAuditEventType` event is raised
- And it carries the calling user, the method, and the affected Role

### Scenario: Failed configuration call raises an audit event with failure status ❌
- When a non-admin attempts `AddIdentity` and is denied
- Then an audit event is raised with `Status = false` / the denial code

---

# Feature: Persistence of Role mappings across restart

> Implementation feature (`saveToBinaryFile` / `loadFromBinaryFile`).

### Scenario: Identity mappings survive a server restart ⚠️
- Given `installRoleSet` is configured with a `persistencePath`
- And `"admin"` added `UserName="joe"` to `Operator`
- When the server stops and starts again loading the same file
- Then `Operator` still has the `UserName="joe"` rule
- And `"joe"` is granted `Operator` on a new session

### Scenario: Missing persistence file starts empty ✅
- Given the persistence file does not exist
- When the server installs the RoleSet
- Then no mapping errors occur and only defaults are present

### Scenario: Corrupt / truncated persistence file ❌
- Given the persistence file is truncated
- When the server loads it
- Then loading fails gracefully (no crash) and is reported

---

# Feature: User Management — provisioning users

> §5.2 — `UserManagement` object with AddUser / ModifyUser / RemoveUser.

**Background:**
- Given a server exposing a `UserManagement` object over an encrypted channel
- And `"admin"` holds `SecurityAdmin`

### Scenario: Admin adds a user who can then log in ❌
- When `"admin"` calls `AddUser("joe", "Secret123!", config, "Joe the operator")`
- Then the call returns `Good`
- And `"joe"` appears in the `Users` property
- And `"joe"` can activate a session with password `"Secret123!"`

### Scenario: Adding a duplicate user fails ❌
- Given `"joe"` already exists
- When `"admin"` calls `AddUser("joe", ...)`
- Then the call returns `Bad_AlreadyExists`

### Scenario: AddUser requires SecurityAdmin and encryption ❌
- When a non-admin calls `AddUser` → `Bad_UserAccessDenied`
- When `AddUser` is called over an unencrypted channel → `Bad_SecurityModeInsufficient`

### Scenario: AddUser then map UserName to a role end-to-end ❌
- Given `"admin"` added user `"joe"`
- And `"admin"` added a `UserName="joe"` rule to `Operator`
- When `"joe"` logs in
- Then `"joe"`'s session holds `Operator`

### Scenario: ModifyUser changes the description ❌
- When `"admin"` calls `ModifyUser("joe", ModifyDescription=true, "Senior operator")`
- Then the `Users` entry for `"joe"` shows the new description

### Scenario: Remove a user closes their sessions ❌
- Given `"joe"` has an active session
- When `"admin"` calls `RemoveUser("joe")`
- Then the call returns `Good`
- And `"joe"`'s session (and subscriptions) are closed by the server
- And `"joe"` can no longer activate a session

### Scenario: Removing a non-existent user fails ❌
- When `"admin"` calls `RemoveUser("ghost")`
- Then the call returns `Bad_NotFound`

### Scenario: Admin cannot remove themselves ❌
> §5.2.7 — `Bad_InvalidSelfReference`
- When `"admin"` calls `RemoveUser("admin")` from `"admin"`'s own session
- Then the call returns `Bad_InvalidSelfReference`

---

# Feature: Password policy enforcement

> §5.2.1-2 — `PasswordLength` Range and `PasswordOptions` mask.

**Background:**
- Given `PasswordLength = [8, 32]`
- And `PasswordOptions` requires upper, lower, digit and special characters

### Scenario: Too-short password is rejected ❌
- When `"admin"` calls `AddUser("joe", "Ab1!", ...)`
- Then the call returns `Bad_OutOfRange`

### Scenario: Password missing a required character class is rejected ❌
- When `"admin"` calls `AddUser("joe", "alllowercase", ...)`
- Then the call returns `Bad_OutOfRange`

### Scenario: Compliant password is accepted ❌
- When `"admin"` calls `AddUser("joe", "Secret123!", ...)`
- Then the call returns `Good`

### Scenario: Unsupported UserConfiguration flag is rejected ❌
- When `"admin"` adds a user with a config flag not advertised in `PasswordOptions`
- Then the call returns `Bad_NotSupported`

---

# Feature: ChangePassword

> §5.2.8 — change the password of the Session user; requires USERNAME token + encryption.

> **Progress:** the password lifecycle is implemented in `InMemoryUserManagementStore`
> ([test_user_management_store.ts](../node-opcua-role-set-common/test/test_user_management_store.ts))
> **and** wired to the UA `ChangePassword` Method via `installUserManagement`, driven
> through `ClientUserManagement` over a PseudoSession
> ([test_user_management_integration.ts](./test/test_user_management_integration.ts)).
> old-fails/new-works, wrong-old, USERNAME-token and encrypted-channel gating are
> covered. The remaining ❌ items (well-known-NodeId-callable, MustChangePassword
> ActivateSession handshake) need a full ActivateSession round-trip.

**Background:**
- Given `"kim"` exists with password `"OldPass1"`
- And `"kim"` is connected over an encrypted channel with a USERNAME token

### Scenario: User changes password; old fails and new works ✅ *(client integration-tested)*
- When `"joe"` calls `ChangePassword("OldPass123!", "NewPass456!")`
- Then the call returns `Good`
- And a new session activation with `"OldPass123!"` is rejected (`Bad_UserAccessDenied`/identity invalid)
- And a new session activation with `"NewPass456!"` succeeds with the same roles as before

### Scenario: Wrong old password is rejected ❌
- When `"joe"` calls `ChangePassword("WrongOld", "NewPass456!")`
- Then the call returns `Bad_IdentityTokenInvalid`
- And the password is unchanged

### Scenario: New password equal to old is rejected ❌
- When `"joe"` calls `ChangePassword("OldPass123!", "OldPass123!")`
- Then the call returns `Bad_AlreadyExists`

### Scenario: New password violates policy ❌
- When `"joe"` calls `ChangePassword("OldPass123!", "weak")`
- Then the call returns `Bad_OutOfRange`

### Scenario: ChangePassword requires a USERNAME token ❌
- Given `"joe"` is connected with an anonymous or X509 token
- When `"joe"` calls `ChangePassword`
- Then the call returns `Bad_InvalidState`

### Scenario: ChangePassword requires encryption ❌
- Given an unencrypted channel
- When `ChangePassword` is called
- Then the call returns `Bad_SecurityModeInsufficient`

### Scenario: ChangePassword blocked by NoChangeByUser ❌
- Given `"joe"` has the `NoChangeByUser` configuration bit set
- When `"joe"` calls `ChangePassword`
- Then the call returns `Bad_NotSupported`

### Scenario: ChangePassword is callable by well-known NodeId even when not browseable ❌
> §5.2.8 — accessible via the well-defined NodeIds even if hidden from the user.
- Given `"joe"`'s effective role is `Anonymous` and the method is not in his browse tree
- When `"joe"` calls `ChangePassword` using the well-known NodeId directly
- Then the call is accepted

---

# Feature: MustChangePassword flow

> §5.2.8 — `Good_PasswordChangeRequired` and the forced-change handshake.

**Background:**
- Given `"admin"` created `"newhire"` with the `MustChangePassword` bit set

### Scenario: First login forces a password change ❌
- When `"newhire"` activates a session with the initial password
- Then `ActivateSession` returns `Good_PasswordChangeRequired`
- And the session holds **only** the `Anonymous` role
- And the session cannot read/write protected nodes

### Scenario: Changing the password clears the flag and grants roles ❌
- Given `"newhire"`'s session is in the password-change-required state
- When `"newhire"` calls `ChangePassword(initial, newCompliant)`
- And then re-activates the session with `newCompliant`
- Then `ActivateSession` returns `Good`
- And `"newhire"` now holds the configured roles
- And the `MustChangePassword` bit for `"newhire"` is now FALSE

### Scenario: MustChangePassword combined with NoChangeByUser is invalid ❌
> §5.2.3 — the `MustChangePassword` bit is invalid if `NoChangeByUser` is set.
- When `"admin"` adds a user with both bits set
- Then the call returns `Bad_ConfigurationError`

---

# Feature: User disable

> §5.2.3 / §5.2.6 — `Disabled` bit; disabling closes sessions.

**Background:**
- Given `"joe"` is an active operator

### Scenario: Disabling a user closes their sessions ❌
- When `"admin"` calls `ModifyUser("joe", ModifyUserConfiguration=true, Disabled)`
- Then `"joe"`'s sessions and subscriptions are closed
- And a disabled user behaves like a non-existent user at `ActivateSession`

### Scenario: Admin cannot disable themselves ❌
- When `"admin"` calls `ModifyUser("admin", ... Disabled)` from `"admin"`'s session
- Then the call returns `Bad_InvalidSelfReference`

### Scenario: NoDelete user cannot be removed ❌
- Given `"service"` has the `NoDelete` bit set
- When `"admin"` calls `RemoveUser("service")`
- Then the call returns `Bad_NotSupported`

---

# Feature: End-to-end permission enforcement (role → permission → operation)

> Ties RoleSet to actual authorization on Nodes (the real-world payoff).

**Background:**
- Given node `Setpoint` grants `Write` to `Operator` and `SecurityAdmin` only
- And node `Config` grants `Write` to `SecurityAdmin` only

### Scenario: Operator can write Setpoint but not Config ❌
- Given `"joe"` is mapped to `Operator`
- When `"joe"` writes `Setpoint` → `Good`
- And `"joe"` writes `Config` → `Bad_UserAccessDenied`

### Scenario: Observer can read but not write ❌
- Given `"obs"` is mapped to `Observer`
- When `"obs"` reads `Setpoint` → `Good`
- And `"obs"` writes `Setpoint` → `Bad_UserAccessDenied`

### Scenario: Anonymous is denied protected reads ❌
- Given an anonymous session
- When it reads a node restricted to authenticated roles
- Then the read returns `Bad_UserAccessDenied`

### Scenario: Full lifecycle — provision, use, rotate, revoke ❌  *(flagship e2e)*
- Given `"admin"` adds user `"joe"` and maps `UserName="joe"` to `Operator`
- When `"joe"` logs in and writes `Setpoint` → `Good`
- And `"joe"` rotates the password via `ChangePassword` (old then fails, new works)
- And `"admin"` revokes the `Operator` mapping
- Then `"joe"`'s active session loses write access to `Setpoint`
- And when `"admin"` removes user `"joe"`, his session is closed and he cannot reconnect

---

## Suggested implementation order (highest-value gaps first)

1. **Encrypted-channel enforcement** (`Bad_SecurityModeInsufficient`) — security-critical, touches every method.
2. **Live role re-evaluation on active sessions** — required for correctness, not just convenience.
3. **Well-known role immutability** + **`Bad_AlreadyExists` / `Bad_RequestNotAllowed`** on AddIdentity.
4. **End-to-end permission enforcement tests** (role → operation) — proves the feature actually gates access.
5. **User Management (§5)** — AddUser/ModifyUser/RemoveUser/ChangePassword + MustChangePassword.
6. **Audit events** (§4.5).
7. **AddRole / RemoveRole** (custom roles).
8. **Application / Endpoint restrictions** and remaining criteria types (TrustedApplication, Application, X509Subject full DN, JWT Role/GroupId).
