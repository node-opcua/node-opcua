/**
 * End-to-end scenario backlog for OPC UA Role-Based Security & User
 * Management (OPC 10000-18).
 *
 * Each `it(...)` below is a *pending* (unimplemented) test mirroring
 * `SCENARIOS.md`. They document the intended behaviour and the gaps that
 * remain. Scenarios already covered by concrete tests are unit-tested in
 * their owning packages:
 *   - X509Subject DN matching, duplicate detection
 *       → node-opcua-role-set-common/test/test_x509_subject.ts
 *   - encrypted-channel, role immutability, weak-rule & duplicate rejection
 *       → node-opcua-role-set-server/test/test_bind_role_methods.ts
 *
 * As gaps are implemented, promote the relevant pending `it(...)` here into
 * a real integration test (PseudoSession or a full client/server round-trip)
 * and update SCENARIOS.md.
 */
import "mocha";

describe("E2E backlog: Secure channel enforcement (OPC 10000-18 §4.4)", () => {
    it("rejects reading the Identities property over an unencrypted channel");
    it("hides Role config Methods from non-admin sessions on browse");
});

describe("E2E backlog: Live re-evaluation of Role assignment (§4.4.1)", () => {
    // ✅ covered by test_role_set_integration.ts ("live re-evaluation of an active session"):
    //    granting and revoking a role both take effect on an already-active session
    //    (roles are recomputed per request, not cached).
    it("re-evaluates subscriptions/monitored items on role change (not yet covered)");
});

describe("E2E backlog: Custom Role management — AddRole / RemoveRole (§4.2)", () => {
    it("adds a new custom role and exposes it in the RoleSet");
    it("returns Bad_AlreadyExists when adding a duplicate role");
    it("reuses the well-known NodeId when adding a well-known role by name/namespace");
    it("returns Bad_SecurityModeInsufficient for AddRole over an unencrypted channel");
    it("removes a custom role and drops its permissions");
    it("returns Bad_NodeIdUnknown when removing an unknown role");
    it("returns Bad_RequestNotAllowed when removing an immutable well-known role");
});

describe("E2E backlog: Application restrictions — Applications/AddApplication (§4.4.7-8)", () => {
    it("include list grants the role only to listed applications");
    it("exclude list blocks the role for listed applications");
    it("requires a signed channel when Applications is non-empty");
    it("returns Bad_AlreadyExists / Bad_NotFound for duplicate / unknown application URIs");
});

describe("E2E backlog: Endpoint restrictions — Endpoints/AddEndpoint (§4.4.9-10)", () => {
    it("limits a role to a specific endpoint");
    it("ignores default-valued EndpointType fields during comparison");
});

describe("E2E backlog: Combined identity + application + endpoint criteria (§4.4.1)", () => {
    it("grants the role only when all configured conditions match");
});

describe("E2E backlog: Additional identity criteria types (§4.4.4)", () => {
    it("grants a role via TrustedApplication criteria over a signed channel");
    it("grants a role via Application (ApplicationUri) criteria");
    it("grants a role via JWT Role criteria");
    it("grants a role via JWT GroupId criteria");
});

describe("E2E backlog: Audit events — RoleMappingRuleChangedAuditEventType (§4.5)", () => {
    it("raises an audit event after a successful AddIdentity");
    it("raises an audit event with a failure status when a config call is denied");
});

describe("E2E backlog: Persistence across restart", () => {
    it("restores identity mappings from the persistence file after a restart");
    it("fails gracefully on a corrupt / truncated persistence file");
});

describe("E2E backlog: User Management — AddUser/ModifyUser/RemoveUser (§5.2)", () => {
    it("adds a user who can then activate a session");
    it("returns Bad_AlreadyExists for a duplicate user");
    it("requires SecurityAdmin and an encrypted channel for AddUser");
    it("maps a UserName identity rule to a role for a newly added user");
    it("modifies a user description via ModifyUser");
    it("closes the user's sessions when the user is removed");
    it("returns Bad_NotFound when removing a non-existent user");
    it("returns Bad_InvalidSelfReference when an admin removes themselves");
});

describe("E2E backlog: Password policy (§5.2.1-2)", () => {
    it("rejects a too-short password with Bad_OutOfRange");
    it("rejects a password missing a required character class");
    it("accepts a compliant password");
    it("rejects an unsupported UserConfiguration flag with Bad_NotSupported");
});

describe("E2E backlog: ChangePassword (§5.2.8)", () => {
    it("changes the password — old password fails and new password works");
    it("returns Bad_IdentityTokenInvalid for a wrong old password");
    it("returns Bad_AlreadyExists when the new password equals the old");
    it("returns Bad_OutOfRange when the new password violates policy");
    it("returns Bad_InvalidState when the session token is not USERNAME");
    it("returns Bad_SecurityModeInsufficient over an unencrypted channel");
    it("returns Bad_NotSupported when the user has NoChangeByUser set");
    it("is callable by the well-known NodeId even when not browseable");
});

describe("E2E backlog: MustChangePassword flow (§5.2.8)", () => {
    // ✅ covered by test_user_management_server_e2e.ts (real OPCUAServer):
    //    - first login flagged Good_PasswordChangeRequired (via userManager adapter)
    //    - ChangePassword clears the flag; old password rejected, new accepted on re-activate
    // ✅ Bad_ConfigurationError (MustChangePassword + NoChangeByUser) covered by
    //    test_user_management_store.ts
    it("closes the restricted session's elevated access until the password is changed");
});

describe("E2E backlog: User disable (§5.2.3 / §5.2.6)", () => {
    it("closes the user's sessions when the user is disabled");
    it("returns Bad_InvalidSelfReference when an admin disables themselves");
    it("returns Bad_NotSupported when removing a NoDelete user");
});

describe("E2E backlog: Permission enforcement (role → operation)", () => {
    it("lets an Operator write Setpoint but not Config");
    it("lets an Observer read but not write");
    it("denies Anonymous protected reads");
    it("flagship lifecycle: provision → use → rotate password → revoke → remove");
});
