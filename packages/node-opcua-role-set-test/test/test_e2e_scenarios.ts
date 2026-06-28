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
    // ✅ covered by test_role_set_integration.ts ("AddRole / RemoveRole through the client"):
    //    add (ns=1;g=<uuid>) + configure, duplicate-name (any namespace) rejection,
    //    well-known-name impersonation rejection, non-admin & unencrypted denial,
    //    well-known removal forbidden, BadNodeIdUnknown for unknown role, getRoleByNodeId.
    // Deviation: the spec's "reuse the well-known NodeId when adding a well-known role
    // by name + UA namespace URI" is intentionally replaced by impersonation rejection.
    it("adds the optional Applications/Endpoints restriction Methods to a custom role (not yet)");
});

// Application restrictions (§4.4.1, §4.4.7-8) — ✅ covered:
//   - role-set-common/test/test_role_restriction_store.ts (matching: include/exclude, signed channel)
//   - role-set-test/test/test_role_set_integration.ts (AddApplication via client → store →
//     resolver enforcement; duplicate/unknown; granted only for complying app over a signed channel)
// Endpoint restrictions (§4.4.9-10) — ✅ covered: matching unit-tested
// (role-set-common) and enforced end-to-end via getCurrentUserRoles now that the
// SessionContext surfaces the endpoint URL (role-set-test/test_role_set_integration.ts).

describe("E2E backlog: Additional identity criteria types (§4.4.4)", () => {
    it("grants a role via TrustedApplication criteria over a signed channel");
    it("grants a role via Application (ApplicationUri) criteria");
    it("grants a role via JWT Role / GroupId criteria");
});

// Audit events (§4.5) — ✅ covered:
//   - role-set-server/test/test_bind_role_methods.ts (onAudit: success, refusal, no-audit-before-auth)
//   - role-set-test/test/test_role_set_integration.ts (RoleMappingRuleChangedAuditEventType
//     raised on the Server object, observed in-process)

describe("E2E backlog: Session lifecycle on user change (§5.2.6-7)", () => {
    it("closes the user's sessions when the user is removed");
    it("closes the user's sessions when the user is disabled");
});

describe("E2E backlog: Permission enforcement (role → operation)", () => {
    it("lets an Operator write an Operator-gated node but not a SecurityAdmin-gated one");
    it("denies Anonymous a protected read");
});
