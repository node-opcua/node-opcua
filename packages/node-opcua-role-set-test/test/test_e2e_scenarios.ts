/**
 * Remaining e2e backlog for OPC UA Role-Based Security & User Management
 * (OPC 10000-18). Each `it(...)` without a body is a *pending* test for work
 * not yet implemented. See SCENARIOS.md for the full coverage matrix.
 *
 * Already covered by concrete tests (NOT repeated here):
 *   - identity criteria, X509 full-DN, duplicate detection
 *       → role-set-common/test/test_x509_subject.ts, test_identity_mapping_store.ts
 *   - AddIdentity/RemoveIdentity: encrypted channel, immutability, weak-rule &
 *     duplicate rejection, SecurityAdmin authorization
 *       → role-set-server/test/test_bind_role_methods.ts
 *       → role-set-test/test/test_role_set_integration.ts (client-driven)
 *   - live re-evaluation of an active session (grant + revoke), §4.4.1
 *       → role-set-test/test/test_role_set_integration.ts
 *   - persistence across restart (load on startup)
 *       → role-set-server/test/test_install_role_set.ts
 *   - User Management AddUser/ModifyUser/RemoveUser, password policy,
 *     self-reference, NoDelete, ChangePassword (old-fails/new-works), §5
 *       → role-set-common/test/test_user_management_store.ts
 *       → role-set-server/test/test_bind_user_management.ts
 *       → role-set-test/test/test_user_management_integration.ts (client-driven)
 *   - MustChangePassword over a real OPCUAServer; client-side detection via
 *     sessionRequiresPasswordChange; disabled user cannot activate, §5.2.8/§5.2.3
 *       → role-set-test/test/test_user_management_server_e2e.ts
 */
import "mocha";

describe("E2E backlog: Secure channel / browse visibility (§4.4.1)", () => {
    it("rejects reading the Identities property over an unencrypted channel");
    it("hides Role config Methods from non-admin sessions on browse");
});

describe("E2E backlog: Custom Role management — AddRole / RemoveRole (§4.2)", () => {
    it("adds a new custom role and exposes it in the RoleSet");
    it("returns Bad_AlreadyExists when adding a duplicate role");
    it("reuses the well-known NodeId when adding a well-known role by name/namespace");
    it("returns Bad_SecurityModeInsufficient for AddRole over an unencrypted channel");
    it("removes a custom role and drops its permissions");
    it("returns Bad_NodeIdUnknown when removing an unknown role");
});

describe("E2E backlog: Application restrictions — Applications/AddApplication (§4.4.7-8)", () => {
    it("include list grants the role only to listed applications");
    it("exclude list blocks the role for listed applications");
    it("requires a signed channel when Applications is non-empty");
});

describe("E2E backlog: Endpoint restrictions — Endpoints/AddEndpoint (§4.4.9-10)", () => {
    it("limits a role to a specific endpoint");
    it("ignores default-valued EndpointType fields during comparison");
});

describe("E2E backlog: Additional identity criteria types (§4.4.4)", () => {
    it("grants a role via TrustedApplication criteria over a signed channel");
    it("grants a role via Application (ApplicationUri) criteria");
    it("grants a role via JWT Role / GroupId criteria");
});

describe("E2E backlog: Audit events — RoleMappingRuleChangedAuditEventType (§4.5)", () => {
    it("raises an audit event after a successful AddIdentity");
    it("raises an audit event with a failure status when a config call is denied");
});

describe("E2E backlog: Session lifecycle on user change (§5.2.6-7)", () => {
    it("closes the user's sessions when the user is removed");
    it("closes the user's sessions when the user is disabled");
});

describe("E2E backlog: Permission enforcement (role → operation)", () => {
    it("lets an Operator write an Operator-gated node but not a SecurityAdmin-gated one");
    it("denies Anonymous a protected read");
});
