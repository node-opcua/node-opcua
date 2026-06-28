/**
 * Integration tests for node-opcua-role-set.
 *
 * These tests wire the **server side** (`installRoleSet`, which aggregates the
 * Roles and registers a store-backed role resolver) to the **role-set client**
 * (`browseRoles` / `ClientRole` / `readAllRoleIdentities`) over an in-process
 * `PseudoSession`. The `SessionContext` simulates the calling user and the
 * SecureChannel security mode, so authorization (SecurityAdmin) and the
 * encrypted-channel requirement flow through exactly as they would on a real
 * server — without a TCP stack.
 *
 * Every mutation goes through the client API and the bound server Methods
 * (client → AddIdentity/RemoveIdentity → store → Identities variable refresh →
 * client read-back), so the client is exercised the way an application uses it.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { AddressSpace, type IServerBase } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { NodeId, NodeIdType, sameNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { ClientRoleSet } from "node-opcua-role-set-client";
import {
    InMemoryIdentityMappingStore,
    type IRoleRestrictionStore,
    saveToBinaryFile,
    WellKnownRoleIds
} from "node-opcua-role-set-common";
import { type IServerForRoleSet, installRoleSet, type RoleSetResolver } from "node-opcua-role-set-server";
import { StatusCodes } from "node-opcua-status-code";
import { IdentityCriteriaType, IdentityMappingRuleType, MessageSecurityMode, UserNameIdentityToken } from "node-opcua-types";
import should from "should";
import { anonymousSession, userSession } from "./helpers.js";

/** The server-like object understood by both installRoleSet and SessionContext. */
type TestServer = IServerForRoleSet & IServerBase;

function makeRule(criteriaType: IdentityCriteriaType, criteria: string): IdentityMappingRuleType {
    return new IdentityMappingRuleType({ criteriaType, criteria });
}

describe("RoleSet Integration: server aggregator + role-set client over PseudoSession", function () {
    this.timeout(30000);

    const tmpDir = path.join(__dirname, "..", "_tmp_integration");
    const persistencePath = path.join(tmpDir, "roles.bin");

    let addressSpace: AddressSpace;
    let server: TestServer;
    let resolver: RoleSetResolver;
    let restrictionStore: IRoleRestrictionStore;

    /** A ClientRoleSet bound to an admin session (SignAndEncrypt by default). */
    function adminRoleSet(securityMode = MessageSecurityMode.SignAndEncrypt): ClientRoleSet {
        return new ClientRoleSet(userSession(addressSpace, server, "admin", securityMode));
    }

    /** Resolve a Role through the client, asserting it exists. */
    async function getClientRole(roleSet: ClientRoleSet, name: string) {
        const role = await roleSet.getRole(name);
        if (!role) throw new Error(`role ${name} not found`);
        return role;
    }

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://integration-test");
        await generateAddressSpace(addressSpace, [nodesets.standard]);

        // Bootstrap admin: persist a store mapping UserName "admin" -> SecurityAdmin
        // so installRoleSet loads it and the admin session resolves to SecurityAdmin.
        const bootstrap = new InMemoryIdentityMappingStore();
        bootstrap.addIdentity(WellKnownRoleIds.SecurityAdmin, makeRule(IdentityCriteriaType.UserName, "admin"));
        await saveToBinaryFile(bootstrap, persistencePath);

        server = {
            roleResolvers: [],
            engine: { addressSpace },
            // userManager must expose getUserRoles for SessionContext role resolution;
            // the store-backed resolver (added by installRoleSet) provides the real roles.
            userManager: { getUserRoles: () => [] }
        } as TestServer;

        const installed = await installRoleSet(server, { persistencePath });
        resolver = installed.resolver;
        restrictionStore = installed.restrictionStore;
    });

    after(async () => {
        addressSpace.dispose();
        await fs.rm(tmpDir, { recursive: true, force: true }).catch((err: Error) => {
            console.warn(`could not remove temp dir ${tmpDir}: ${err.message}`);
        });
    });

    describe("role discovery via the client", () => {
        it("should discover all well-known roles", async () => {
            const roles = await adminRoleSet().getRoles();
            const names = roles.map((r) => r.roleName);
            names.should.containEql("Anonymous");
            names.should.containEql("AuthenticatedUser");
            names.should.containEql("SecurityAdmin");
            names.should.containEql("Operator");
        });

        it("should expose the bootstrapped SecurityAdmin identity", async () => {
            const results = await adminRoleSet().readAllRoleIdentities();
            const secAdmin = results.find((r) => r.roleName === "SecurityAdmin");
            should.exist(secAdmin);
            secAdmin?.identities.should.have.length(1);
            should(secAdmin?.identities[0].criteria).equal("admin");
        });
    });

    describe("authorization flows through the role resolver", () => {
        it("should resolve the admin user to SecurityAdmin via the registered resolver", () => {
            const roles = resolver.resolveRoles(new UserNameIdentityToken({ userName: "admin" }));
            roles.some((r) => sameNodeId(r, WellKnownRoleIds.SecurityAdmin)).should.be.true();
        });
    });

    describe("AddIdentity / RemoveIdentity round-trip through the client", () => {
        it("admin can add an identity to Operator and read it back via the client", async () => {
            const role = await getClientRole(adminRoleSet(), "Operator");

            const addResult = await role.addIdentity(makeRule(IdentityCriteriaType.UserName, "joe"));
            addResult.statusCode.should.equal(StatusCodes.Good);

            const identities = await role.readIdentities();
            identities.should.have.length(1);
            should(identities[0].criteria).equal("joe");

            // the resolver now grants Operator to joe — proving the round-trip
            const joeRoles = resolver.resolveRoles(new UserNameIdentityToken({ userName: "joe" }));
            joeRoles.some((r) => sameNodeId(r, role.roleNodeId)).should.be.true();
        });

        it("admin can remove the identity again", async () => {
            const role = await getClientRole(adminRoleSet(), "Operator");

            const removeResult = await role.removeIdentity(makeRule(IdentityCriteriaType.UserName, "joe"));
            removeResult.statusCode.should.equal(StatusCodes.Good);
            (await role.readIdentities()).should.have.length(0);
        });

        it("should reject a duplicate identity with BadAlreadyExists", async () => {
            const role = await getClientRole(adminRoleSet(), "Operator");

            (await role.addIdentity(makeRule(IdentityCriteriaType.UserName, "kate"))).statusCode.should.equal(StatusCodes.Good);
            (await role.addIdentity(makeRule(IdentityCriteriaType.UserName, "kate"))).statusCode.should.equal(
                StatusCodes.BadAlreadyExists
            );
            // cleanup
            await role.removeIdentity(makeRule(IdentityCriteriaType.UserName, "kate"));
        });
    });

    describe("security enforcement through the client", () => {
        it("should deny a non-admin (anonymous) session with BadUserAccessDenied", async () => {
            const role = await getClientRole(new ClientRoleSet(anonymousSession(addressSpace, server)), "Operator");
            const result = await role.addIdentity(makeRule(IdentityCriteriaType.UserName, "mallory"));
            result.statusCode.should.equal(StatusCodes.BadUserAccessDenied);
        });

        it("should deny an unencrypted admin channel with BadSecurityModeInsufficient", async () => {
            const role = await getClientRole(adminRoleSet(MessageSecurityMode.None), "Operator");
            const result = await role.addIdentity(makeRule(IdentityCriteriaType.UserName, "joe"));
            result.statusCode.should.equal(StatusCodes.BadSecurityModeInsufficient);
        });

        it("should report BadNotSupported when modifying the immutable Anonymous role", async () => {
            // The standard nodeset enforces immutability (§4.3) by NOT exposing an
            // AddIdentity Method on the Anonymous role; the client surfaces this as
            // BadNotSupported rather than throwing.
            const role = await getClientRole(adminRoleSet(), "Anonymous");
            const result = await role.addIdentity(makeRule(IdentityCriteriaType.UserName, "x"));
            result.statusCode.should.equal(StatusCodes.BadNotSupported);
        });
    });

    describe("live re-evaluation of an active session (§4.4.1)", () => {
        it("re-evaluates roles on an already-active session after its mapping changes", async () => {
            // "ivan" is connected throughout; his SecurityAdmin grant changes mid-session.
            const ivanRoleSet = new ClientRoleSet(userSession(addressSpace, server, "ivan"));
            const operatorAsIvan = await getClientRole(ivanRoleSet, "Operator");

            // initially ivan is not SecurityAdmin → cannot configure roles
            (await operatorAsIvan.addIdentity(makeRule(IdentityCriteriaType.UserName, "x1"))).statusCode.should.equal(
                StatusCodes.BadUserAccessDenied
            );

            // admin grants ivan the SecurityAdmin role
            const secAdmin = await getClientRole(adminRoleSet(), "SecurityAdmin");
            (await secAdmin.addIdentity(makeRule(IdentityCriteriaType.UserName, "ivan"))).statusCode.should.equal(StatusCodes.Good);

            // ivan's SAME session is re-evaluated (roles are recomputed per request)
            // and he is now allowed to configure roles — no reconnection required
            (await operatorAsIvan.addIdentity(makeRule(IdentityCriteriaType.UserName, "x2"))).statusCode.should.equal(
                StatusCodes.Good
            );

            // revoking the grant takes effect on the same active session too
            (await secAdmin.removeIdentity(makeRule(IdentityCriteriaType.UserName, "ivan"))).statusCode.should.equal(
                StatusCodes.Good
            );
            (await operatorAsIvan.addIdentity(makeRule(IdentityCriteriaType.UserName, "x3"))).statusCode.should.equal(
                StatusCodes.BadUserAccessDenied
            );

            // cleanup the identity ivan managed to add
            await secAdmin.removeIdentity(makeRule(IdentityCriteriaType.UserName, "ivan")); // no-op if already gone
            const cleanup = await getClientRole(adminRoleSet(), "Operator");
            await cleanup.removeIdentity(makeRule(IdentityCriteriaType.UserName, "x2"));
        });
    });

    describe("AddRole / RemoveRole through the client (§4.2)", () => {
        it("admin adds a custom role as ns=1;g=<uuid> and can configure it", async () => {
            const roleSet = adminRoleSet();
            const { statusCode, roleNodeId } = await roleSet.addRole("Maintenance");
            statusCode.should.equal(StatusCodes.Good);
            if (!roleNodeId) throw new Error("expected a RoleNodeId");
            roleNodeId.namespace.should.equal(1);
            roleNodeId.identifierType.should.equal(NodeIdType.GUID);

            // it appears in the RoleSet for a fresh client — found by name and by NodeId
            (await adminRoleSet().getRoles()).map((r) => r.roleName).should.containEql("Maintenance");
            const byId = await adminRoleSet().getRoleByNodeId(roleNodeId);
            should.exist(byId);
            byId?.roleName.should.equal("Maintenance");

            // its AddIdentity is bound → the role is configurable
            const role = await getClientRole(adminRoleSet(), "Maintenance");
            (await role.addIdentity(makeRule(IdentityCriteriaType.UserName, "mech"))).statusCode.should.equal(StatusCodes.Good);
            (await role.readIdentities()).should.have.length(1);

            // RemoveRole drops it from the RoleSet
            (await roleSet.removeRole(roleNodeId)).statusCode.should.equal(StatusCodes.Good);
            (await adminRoleSet().getRoles()).map((r) => r.roleName).should.not.containEql("Maintenance");
        });

        it("returns BadAlreadyExists for a duplicate role name", async () => {
            const roleSet = adminRoleSet();
            const { roleNodeId } = await roleSet.addRole("Dup");
            if (!roleNodeId) throw new Error("expected a RoleNodeId");
            // duplicate by name (any namespace) is rejected
            (await adminRoleSet().addRole("Dup")).statusCode.should.equal(StatusCodes.BadAlreadyExists);
            (await adminRoleSet().addRole("Dup", "urn:other")).statusCode.should.equal(StatusCodes.BadAlreadyExists);
            await roleSet.removeRole(roleNodeId);
        });

        it("rejects a custom role that impersonates a well-known role name", async () => {
            (await adminRoleSet().addRole("Operator")).statusCode.should.equal(StatusCodes.BadAlreadyExists);
            (await adminRoleSet().addRole("SecurityAdmin")).statusCode.should.equal(StatusCodes.BadAlreadyExists);
        });

        it("denies AddRole to a non-admin and over an unencrypted channel", async () => {
            (await new ClientRoleSet(anonymousSession(addressSpace, server)).addRole("Nope")).statusCode.should.equal(
                StatusCodes.BadUserAccessDenied
            );
            (await adminRoleSet(MessageSecurityMode.None).addRole("Nope")).statusCode.should.equal(
                StatusCodes.BadSecurityModeInsufficient
            );
        });

        it("forbids removing a well-known role with BadRequestNotAllowed", async () => {
            const operatorId = (await getClientRole(adminRoleSet(), "Operator")).roleNodeId;
            (await adminRoleSet().removeRole(operatorId)).statusCode.should.equal(StatusCodes.BadRequestNotAllowed);
        });

        it("returns BadNodeIdUnknown when removing an unknown role", async () => {
            const unknown = new NodeId(NodeIdType.NUMERIC, 987654, 1);
            (await adminRoleSet().removeRole(unknown)).statusCode.should.equal(StatusCodes.BadNodeIdUnknown);
        });
    });

    describe("application restrictions enforced by the resolver (§4.4.1)", () => {
        it("grants the role only to a complying application over a signed channel", async () => {
            // map "kayla" -> Operator, then restrict Operator to urn:acme:hmi
            const operator = await getClientRole(adminRoleSet(), "Operator");
            (await operator.addIdentity(makeRule(IdentityCriteriaType.UserName, "kayla"))).statusCode.should.equal(
                StatusCodes.Good
            );
            restrictionStore.addApplication(operator.roleNodeId, "urn:acme:hmi"); // include-list

            const kayla = new UserNameIdentityToken({ userName: "kayla" });
            const hasOperator = (roles: ReturnType<typeof resolver.resolveRoles>) =>
                roles.some((r) => sameNodeId(r, operator.roleNodeId));

            // complying application + signed channel → granted
            hasOperator(
                resolver.resolveRoles(kayla, { applicationUri: "urn:acme:hmi", securityMode: MessageSecurityMode.SignAndEncrypt })
            ).should.be.true();
            // wrong application → denied
            hasOperator(
                resolver.resolveRoles(kayla, { applicationUri: "urn:other:app", securityMode: MessageSecurityMode.SignAndEncrypt })
            ).should.be.false();
            // right application but unsigned channel → denied (Applications non-empty requires signing)
            hasOperator(
                resolver.resolveRoles(kayla, { applicationUri: "urn:acme:hmi", securityMode: MessageSecurityMode.None })
            ).should.be.false();
            // no resolution context → no enforcement (granted)
            hasOperator(resolver.resolveRoles(kayla)).should.be.true();

            // cleanup
            restrictionStore.removeApplication(operator.roleNodeId, "urn:acme:hmi");
            await operator.removeIdentity(makeRule(IdentityCriteriaType.UserName, "kayla"));
        });

        it("does not affect roles with no application restriction", async () => {
            const operator = await getClientRole(adminRoleSet(), "Operator");
            (await operator.addIdentity(makeRule(IdentityCriteriaType.UserName, "nora"))).statusCode.should.equal(StatusCodes.Good);
            const nora = new UserNameIdentityToken({ userName: "nora" });
            resolver
                .resolveRoles(nora, { applicationUri: null, securityMode: MessageSecurityMode.None })
                .some((r) => sameNodeId(r, operator.roleNodeId))
                .should.be.true();
            await operator.removeIdentity(makeRule(IdentityCriteriaType.UserName, "nora"));
        });
    });

    describe("audit events (§4.5)", () => {
        interface AuditFields {
            clientUserId: { value: string };
            sourceName: { value: string };
            status: { value: boolean };
        }

        it("raises a RoleMappingRuleChangedAuditEventType on AddIdentity (user, source, status)", async () => {
            const serverObject = addressSpace.rootFolder.objects.server;
            const events: AuditFields[] = [];
            const emitter = serverObject as unknown as {
                on(event: string, cb: (data: unknown) => void): void;
                removeListener(event: string, cb: (data: unknown) => void): void;
            };
            const listener = (data: unknown) => events.push(data as AuditFields);
            emitter.on("event", listener);
            try {
                const role = await getClientRole(adminRoleSet(), "Operator");
                (await role.addIdentity(makeRule(IdentityCriteriaType.UserName, "auditee"))).statusCode.should.equal(
                    StatusCodes.Good
                );

                events.length.should.be.greaterThan(0);
                const audit = events[events.length - 1];
                audit.clientUserId.value.should.equal("admin");
                audit.sourceName.value.should.equal("Method/AddIdentity");
                audit.status.value.should.equal(true);

                await role.removeIdentity(makeRule(IdentityCriteriaType.UserName, "auditee"));
            } finally {
                emitter.removeListener("event", listener);
            }
        });
    });
});
