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
import { AddressSpace, type IServerBase, type ISessionBase, PseudoSession, SessionContext } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { MockContinuationPointManager } from "node-opcua-address-space/testHelpers";
import { sameNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { ClientRoleSet } from "node-opcua-role-set-client";
import { InMemoryIdentityMappingStore, saveToBinaryFile, WellKnownRoleIds } from "node-opcua-role-set-common";
import { type IServerForRoleSet, installRoleSet, type RoleSetResolver } from "node-opcua-role-set-server";
import { StatusCodes } from "node-opcua-status-code";
import {
    AnonymousIdentityToken,
    IdentityCriteriaType,
    IdentityMappingRuleType,
    MessageSecurityMode,
    type UserIdentityToken,
    UserNameIdentityToken
} from "node-opcua-types";
import should from "should";

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

    /** Build a SessionContext for a given user identity + channel security mode. */
    function makeContext(userIdentityToken: UserIdentityToken, securityMode: MessageSecurityMode): SessionContext {
        const session: ISessionBase = {
            getSessionId: () => WellKnownRoleIds.Anonymous, // any NodeId — unused by these tests
            continuationPointManager: new MockContinuationPointManager(),
            userIdentityToken,
            channel: {
                securityMode,
                securityPolicy: "",
                clientCertificate: null,
                getTransportSettings: () => ({ maxMessageSize: 0 })
            }
        };
        return new SessionContext({ server, session });
    }

    function adminSession(securityMode = MessageSecurityMode.SignAndEncrypt): PseudoSession {
        return new PseudoSession(addressSpace, makeContext(new UserNameIdentityToken({ userName: "admin" }), securityMode));
    }
    function anonymousSession(): PseudoSession {
        return new PseudoSession(addressSpace, makeContext(new AnonymousIdentityToken(), MessageSecurityMode.SignAndEncrypt));
    }

    /** A ClientRoleSet bound to an admin session (SignAndEncrypt by default). */
    function adminRoleSet(securityMode = MessageSecurityMode.SignAndEncrypt): ClientRoleSet {
        return new ClientRoleSet(adminSession(securityMode));
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

        resolver = (await installRoleSet(server, { persistencePath })).resolver;
    });

    after(async () => {
        addressSpace.dispose();
        try {
            await fs.rm(tmpDir, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
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
            const role = await getClientRole(new ClientRoleSet(anonymousSession()), "Operator");
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
});
