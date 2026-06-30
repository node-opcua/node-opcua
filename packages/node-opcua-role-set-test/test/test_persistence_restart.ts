/**
 * Restart test: a custom Role created via AddRole (and its identity mappings)
 * must survive a server restart — the GUID NodeId is regenerable only because
 * it is persisted in the single consolidated archive at `persistencePath`.
 *
 * Everything goes through the client; a "restart" is a fresh AddressSpace +
 * installRoleSet pointing at the same persistence path. A second case proves
 * the same works with an encrypted-at-rest archive (operator secret).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { AddressSpace, type IServerBase } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { ClientRoleSet } from "node-opcua-role-set-client";
import { InMemoryIdentityMappingStore, type IRoleRestrictionStore, WellKnownRoleIds } from "node-opcua-role-set-common";
import { type IServerForRoleSet, installRoleSet } from "node-opcua-role-set-server";
import { StatusCodes } from "node-opcua-status-code";
import { IdentityCriteriaType, IdentityMappingRuleType } from "node-opcua-types";
import "should";
import { bootstrapArchive, userSession } from "./helpers.js";

type TestServer = IServerForRoleSet & IServerBase;

function userRule(criteria: string): IdentityMappingRuleType {
    return new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.UserName, criteria });
}

describe("RoleSet persistence across restart", function (this: Mocha.Suite) {
    this.timeout(30000);

    const tmpDir = path.join(__dirname, "..", "_tmp_restart");
    const persistencePath = path.join(tmpDir, "roles.bin");

    /** Stand up a fresh server bound to the same persistence path (a "boot"). */
    async function boot(): Promise<{ addressSpace: AddressSpace; server: TestServer; restrictionStore: IRoleRestrictionStore }> {
        const addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://restart-test");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        const server = {
            roleResolvers: [],
            engine: { addressSpace },
            userManager: { getUserRoles: () => [] }
        } as TestServer;
        const { restrictionStore } = await installRoleSet(server, { persistencePath });
        return { addressSpace, server, restrictionStore };
    }

    before(async () => {
        // seed admin -> SecurityAdmin so the admin session can manage Roles
        const bootstrap = new InMemoryIdentityMappingStore();
        bootstrap.addIdentity(WellKnownRoleIds.SecurityAdmin, userRule("admin"));
        await bootstrapArchive(persistencePath, bootstrap);
    });

    after(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch((err: Error) => {
            console.warn(`could not remove temp dir ${tmpDir}: ${err.message}`);
        });
    });

    it("a custom role and its identity survive a restart (same GUID NodeId)", async () => {
        // --- boot #1: create a custom role and give it an identity ---
        const b1 = await boot();
        const admin1 = new ClientRoleSet(userSession(b1.addressSpace, b1.server, "admin"));
        const { statusCode, roleNodeId } = await admin1.addRole("Maintenance");
        statusCode.should.equal(StatusCodes.Good);
        if (!roleNodeId) throw new Error("expected a RoleNodeId");

        const role1 = await admin1.getRoleByNodeId(roleNodeId);
        if (!role1) throw new Error("custom role not found after AddRole");
        (await role1.addIdentity(userRule("mech"))).statusCode.should.equal(StatusCodes.Good);
        // also configure an application restriction (must persist too)
        (await role1.addApplication("urn:acme:hmi")).statusCode.should.equal(StatusCodes.Good);

        b1.addressSpace.dispose();

        // --- boot #2: restart against the same persistence path ---
        const b2 = await boot();
        const admin2 = new ClientRoleSet(userSession(b2.addressSpace, b2.server, "admin"));

        // the custom Role reappears in the RoleSet, with the SAME NodeId ...
        (await admin2.getRoles()).map((r) => r.roleName).should.containEql("Maintenance");
        const restored = await admin2.getRoleByNodeId(roleNodeId);
        if (!restored) throw new Error("custom role not restored after restart");
        restored.roleName.should.equal("Maintenance");

        // ... and its identity mapping was restored too
        (await restored.readIdentities()).map((i) => i.criteria).should.containEql("mech");

        // ... and so was its application restriction
        b2.restrictionStore.getApplications(roleNodeId).should.containEql("urn:acme:hmi");

        b2.addressSpace.dispose();
    });

    describe("encrypted archive (operator secret)", () => {
        const secDir = path.join(__dirname, "..", "_tmp_restart_enc");
        const secPath = path.join(secDir, "roles.json");
        const secret = "s3cr3t-passphrase";

        async function bootEnc(passphrase?: string): Promise<{ addressSpace: AddressSpace; server: TestServer }> {
            const addressSpace = AddressSpace.create();
            addressSpace.registerNamespace("http://restart-enc-test");
            await generateAddressSpace(addressSpace, [nodesets.standard]);
            const server = { roleResolvers: [], engine: { addressSpace }, userManager: { getUserRoles: () => [] } } as TestServer;
            try {
                await installRoleSet(server, { persistencePath: secPath, persistenceSecret: passphrase });
            } catch (err) {
                // on the failure path (e.g. encrypted archive, missing secret) the
                // AddressSpace would otherwise leak — dispose it before rethrowing.
                addressSpace.dispose();
                throw err;
            }
            return { addressSpace, server };
        }

        before(async () => {
            const bootstrap = new InMemoryIdentityMappingStore();
            bootstrap.addIdentity(WellKnownRoleIds.SecurityAdmin, userRule("admin"));
            await bootstrapArchive(secPath, bootstrap, secret);
        });
        after(async () => {
            await fs.rm(secDir, { recursive: true, force: true }).catch((err: Error) => {
                console.warn(`could not remove temp dir ${secDir}: ${err.message}`);
            });
        });

        it("persists and restores a custom role through an encrypted archive", async () => {
            const b1 = await bootEnc(secret);
            const admin1 = new ClientRoleSet(userSession(b1.addressSpace, b1.server, "admin"));
            const { statusCode, roleNodeId } = await admin1.addRole("Turbine");
            statusCode.should.equal(StatusCodes.Good);
            if (!roleNodeId) throw new Error("expected a RoleNodeId");
            b1.addressSpace.dispose();

            // the on-disk archive is genuinely encrypted (no plaintext role name)
            const onDisk = await fs.readFile(secPath, "utf8");
            onDisk.should.containEql('"encrypted": true');
            onDisk.should.not.containEql("Turbine");

            // restart with the secret → the role is restored
            const b2 = await bootEnc(secret);
            const admin2 = new ClientRoleSet(userSession(b2.addressSpace, b2.server, "admin"));
            (await admin2.getRoles()).map((r) => r.roleName).should.containEql("Turbine");
            b2.addressSpace.dispose();
        });

        it("refuses to start when the archive secret is missing", async () => {
            await bootEnc(undefined).should.be.rejectedWith(/encrypted but no secret/);
        });
    });
});
