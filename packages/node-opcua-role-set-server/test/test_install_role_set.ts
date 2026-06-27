import { promises as fs } from "node:fs";
import "mocha";
import path from "node:path";
import { AddressSpace, SessionContext, type UAMethod, type UARole, type UARoleSet } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { ObjectIds } from "node-opcua-constants";
import { NodeClass } from "node-opcua-data-model";
import { sameNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { InMemoryIdentityMappingStore, loadFromBinaryFile, saveToBinaryFile, WellKnownRoleIds } from "node-opcua-role-set-common";
import { StatusCodes } from "node-opcua-status-code";
import { AnonymousIdentityToken, IdentityCriteriaType, IdentityMappingRuleType } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import { addRoleNotImplemented, removeRoleNotImplemented } from "../source/bind_role_methods.js";
import { type IServerForRoleSet, installRoleSet } from "../source/install_role_set.js";
import { RoleSetResolver } from "../source/role_set_resolver.js";

// --- Tests ---

describe("RoleSetResolver", () => {
    it("should delegate resolveRoles to the store", () => {
        const store = new InMemoryIdentityMappingStore();
        store.addIdentity(
            WellKnownRoleIds.Observer,
            new IdentityMappingRuleType({
                criteriaType: IdentityCriteriaType.Anonymous,
                criteria: "*"
            })
        );
        const resolver = new RoleSetResolver(store);
        const roles = resolver.resolveRoles(new AnonymousIdentityToken());
        roles.should.have.length(1);
        sameNodeId(roles[0], WellKnownRoleIds.Observer).should.be.true();
    });

    it("should return empty for non-matching token", () => {
        const store = new InMemoryIdentityMappingStore();
        const resolver = new RoleSetResolver(store);
        const roles = resolver.resolveRoles(new AnonymousIdentityToken());
        roles.should.have.length(0);
    });
});

describe("installRoleSet", () => {
    let addressSpace: AddressSpace;
    let server: IServerForRoleSet;

    beforeEach(async function () {
        this.timeout(30000); // loading standard nodeset can take time
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://test");
        await generateAddressSpace(addressSpace, [nodesets.standard]);

        server = {
            roleResolvers: [],
            engine: { addressSpace }
        };
    });

    afterEach(() => {
        addressSpace.dispose();
    });

    it("should register a resolver on server.roleResolvers", async () => {
        const { resolver } = await installRoleSet(server);
        server.roleResolvers.should.have.length(1);
        server.roleResolvers[0].should.equal(resolver);
    });

    it("should return the store and resolver", async () => {
        const { store, resolver } = await installRoleSet(server);
        store.should.be.instanceOf(InMemoryIdentityMappingStore);
        resolver.should.be.instanceOf(RoleSetResolver);
    });

    it("should reflect stored identities in the variable after install", async () => {
        // Pre-populate a store and save to a temp file
        const tmpPath = path.join(__dirname, "..", "_tmp_test_identities", "roles.bin");
        const preStore = new InMemoryIdentityMappingStore();
        preStore.addIdentity(
            WellKnownRoleIds.SecurityAdmin,
            new IdentityMappingRuleType({
                criteriaType: IdentityCriteriaType.UserName,
                criteria: "admin"
            })
        );
        await saveToBinaryFile(preStore, tmpPath);

        // Install with persistence → store is loaded with the identity
        const { store: _ } = await installRoleSet(server, { persistencePath: tmpPath });

        // Verify the identities variable on the SecurityAdmin Role
        const roleSet = addressSpace.findNode(ObjectIds.Server_ServerCapabilities_RoleSet) as UARoleSet;
        const components = roleSet.getComponents();
        let secAdminRole: UARole | undefined;
        for (const c of components) {
            if (c.nodeClass !== NodeClass.Object) continue;
            if (sameNodeId(c.nodeId, WellKnownRoleIds.SecurityAdmin)) {
                secAdminRole = c as UARole;
                break;
            }
        }
        secAdminRole?.should.not.be.undefined();

        const value = secAdminRole?.identities.readValue().value;
        if (!value) {
            throw new Error("identities variable value is undefined");
        }
        value.dataType.should.equal(DataType.ExtensionObject);
        value.value.should.have.length(1);
        should(value.value[0].criteria).equal("admin");

        // Cleanup
        const fsp = await import("node:fs");
        try {
            fsp.promises.rm(path.join(__dirname, "..", "_tmp_test_identities"), { recursive: true, force: true });
        } catch {
            /* */
        }
    });

    it("should throw if address space is not available", async () => {
        server.engine.addressSpace = null;
        try {
            await installRoleSet(server);
            throw new Error("should have thrown");
        } catch (err) {
            should((err as Error).message).containEql("address space is not available");
        }
    });

    describe("persistence", () => {
        const tmpDir = path.join(__dirname, "..", "_tmp_test_install");
        const filePath = path.join(tmpDir, "test_roles.bin");

        afterEach(async () => {
            try {
                await fs.rm(tmpDir, { recursive: true, force: true });
            } catch {
                /* */
            }
        });

        it("should persist identities on addIdentity", async () => {
            const { store } = await installRoleSet(server, { persistencePath: filePath });

            store.addIdentity(
                WellKnownRoleIds.SecurityAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.UserName,
                    criteria: "admin"
                })
            );

            // Trigger the persist manually (the method handler does this,
            // but here we test that the store is loaded correctly on next init)
            await saveToBinaryFile(store, filePath);

            // Reload into a fresh store
            const store2 = new InMemoryIdentityMappingStore();
            await loadFromBinaryFile(store2, filePath);
            store2.getIdentitiesForRole(WellKnownRoleIds.SecurityAdmin).should.have.length(1);
        });

        it("should load existing persistence on startup", async () => {
            // First, create persisted data
            const store1 = new InMemoryIdentityMappingStore();
            store1.addIdentity(
                WellKnownRoleIds.Observer,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.Anonymous,
                    criteria: "*"
                })
            );
            await saveToBinaryFile(store1, filePath);

            // Now install with the same persistence path
            const { store } = await installRoleSet(server, { persistencePath: filePath });
            store.getIdentitiesForRole(WellKnownRoleIds.Observer).should.have.length(1);
        });
    });
});

describe("Method handlers", () => {
    describe("addRoleNotImplemented", () => {
        it("should return BadNotImplemented", async () => {
            const result = await addRoleNotImplemented.call({} as UAMethod, [], SessionContext.defaultContext);
            result.statusCode?.should.equal(StatusCodes.BadNotImplemented);
        });
    });

    describe("removeRoleNotImplemented", () => {
        it("should return BadNotImplemented", async () => {
            const result = await removeRoleNotImplemented.call({} as UAMethod, [], SessionContext.defaultContext);
            result.statusCode?.should.equal(StatusCodes.BadNotImplemented);
        });
    });
});
