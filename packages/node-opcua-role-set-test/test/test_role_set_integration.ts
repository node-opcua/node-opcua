/**
 * Integration tests for node-opcua-role-set.
 *
 * Uses PseudoSession (in-process) so we can exercise the full
 * server installRoleSet + client ClientRole round-trip without a
 * real TCP server.
 */
import "should";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AddressSpace, PseudoSession, type UAObject } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { sameNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { browseRoles, ClientRole, readAllRoleIdentities } from "node-opcua-role-set-client";
import { type InMemoryIdentityMappingStore, WellKnownRoleIds } from "node-opcua-role-set-common";
import { type IServerForRoleSet, installRoleSet } from "node-opcua-role-set-server";
import { AnonymousIdentityToken, IdentityCriteriaType, IdentityMappingRuleType, UserNameIdentityToken } from "node-opcua-types";

// --- Integration Tests ---

describe("RoleSet Integration: server + client round-trip", function () {
    this.timeout(30000);

    let addressSpace: AddressSpace;
    let session: PseudoSession;
    let server: IServerForRoleSet;
    let store: InMemoryIdentityMappingStore;

    const tmpDir = path.join(__dirname, "..", "_tmp_integration");
    const persistencePath = path.join(tmpDir, "roles.bin");

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://integration-test");
        await generateAddressSpace(addressSpace, [nodesets.standard]);

        server = {
            roleResolvers: [],
            engine: { addressSpace }
        };

        const result = await installRoleSet(server, { persistencePath });
        store = result.store as InMemoryIdentityMappingStore;

        session = new PseudoSession(addressSpace);
    });

    after(async () => {
        addressSpace.dispose();
        try {
            await fs.rm(tmpDir, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
    });

    describe("browseRoles via client", () => {
        it("should discover all well-known roles", async () => {
            const roles = await browseRoles(session);
            roles.length.should.be.greaterThan(5);

            const names = roles.map((r) => r.roleName);
            names.should.containEql("Anonymous");
            names.should.containEql("AuthenticatedUser");
            names.should.containEql("SecurityAdmin");
        });
    });

    describe("readAllRoleIdentities via client", () => {
        it("should return empty identities initially", async () => {
            const results = await readAllRoleIdentities(session);
            results.length.should.be.greaterThan(0);
            for (const r of results) {
                r.identities.should.have.length(0);
            }
        });
    });

    describe("addIdentity / removeIdentity round-trip", () => {
        it("should add an identity via server store and read it back via client", async () => {
            // Server-side: add identity to the store
            const rule = new IdentityMappingRuleType({
                criteriaType: IdentityCriteriaType.UserName,
                criteria: "admin"
            });
            store.addIdentity(WellKnownRoleIds.SecurityAdmin, rule);

            // Refresh the variable (simulating what afterMutation does)
            // In a real server this happens in the method handler
            const { DataType } = await import("node-opcua-variant");
            const roleSet = addressSpace.findNode("i=15606") as UAObject;
            // We need to trigger a variable refresh — reinstall is simplest
            // but for test we just use setValueFromSource directly
            const { NodeClass } = await import("node-opcua-data-model");
            const components = roleSet.getComponents();
            for (const c of components) {
                if (c.nodeClass !== NodeClass.Object) continue;
                if (sameNodeId(c.nodeId, WellKnownRoleIds.SecurityAdmin)) {
                    c.identities.setValueFromSource({
                        dataType: DataType.ExtensionObject,
                        value: store.getIdentitiesForRole(WellKnownRoleIds.SecurityAdmin)
                    });
                }
            }

            // Client-side: read it back
            const roles = await browseRoles(session);
            const secAdmin = roles.find((r) => r.roleName === "SecurityAdmin");
            if (!secAdmin) {
                throw new Error("SecurityAdmin role not found");
            }
            const clientRole = new ClientRole(session, secAdmin.roleNodeId);
            const identities = await clientRole.readIdentities();

            identities.should.have.length(1);
            identities[0].criteriaType.should.equal(IdentityCriteriaType.UserName);
            identities[0].criteria.should.equal("admin");
        });

        it("should remove the identity and verify it's gone", async () => {
            const rule = new IdentityMappingRuleType({
                criteriaType: IdentityCriteriaType.UserName,
                criteria: "admin"
            });
            const removed = store.removeIdentity(WellKnownRoleIds.SecurityAdmin, rule);
            removed.should.be.true();

            // Refresh variable
            const { DataType } = await import("node-opcua-variant");
            const { NodeClass } = await import("node-opcua-data-model");
            const roleSet = addressSpace.findNode("i=15606") as UAObject;
            const components = roleSet.getComponents();
            for (const c of components) {
                if (c.nodeClass !== NodeClass.Object) continue;
                if (sameNodeId(c.nodeId, WellKnownRoleIds.SecurityAdmin)) {
                    c.identities.setValueFromSource({
                        dataType: DataType.ExtensionObject,
                        value: store.getIdentitiesForRole(WellKnownRoleIds.SecurityAdmin)
                    });
                }
            }

            // Client reads empty
            const roles = await browseRoles(session);
            const secAdmin = roles.find((r) => r.roleName === "SecurityAdmin");
            if (!secAdmin) {
                throw new Error("SecurityAdmin role not found");
            }
            const clientRole = new ClientRole(session, secAdmin.roleNodeId);
            const identities = await clientRole.readIdentities();
            identities.should.have.length(0);
        });
    });

    describe("RoleSetResolver integration", () => {
        it("should resolve roles for matching token after addIdentity", () => {
            store.addIdentity(
                WellKnownRoleIds.Observer,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.Anonymous,
                    criteria: "*"
                })
            );
            store.addIdentity(
                WellKnownRoleIds.SecurityAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.UserName,
                    criteria: "admin"
                })
            );

            // The resolver is registered on server.roleResolvers
            server.roleResolvers.should.have.length(1);
            const resolver = server.roleResolvers[0];

            // Anonymous → Observer
            const anonRoles = resolver.resolveRoles(new AnonymousIdentityToken());
            anonRoles.length.should.equal(1);
            sameNodeId(anonRoles[0], WellKnownRoleIds.Observer).should.be.true();

            // UserName "admin" → SecurityAdmin
            const adminRoles = resolver.resolveRoles(new UserNameIdentityToken({ userName: "admin" }));
            adminRoles.length.should.equal(1);
            sameNodeId(adminRoles[0], WellKnownRoleIds.SecurityAdmin).should.be.true();

            // UserName "bob" → nothing
            const bobRoles = resolver.resolveRoles(new UserNameIdentityToken({ userName: "bob" }));
            bobRoles.length.should.equal(0);
        });
    });
});
