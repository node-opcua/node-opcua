/**
 * Client API tests for node-opcua-role-set-client.
 *
 * All interaction with the RoleSet goes through the `ClientRoleSet` client over
 * a PseudoSession — never through the address space, UAObject or UAVariable
 * directly. The address space is only stood up as the (in-process) server.
 */
import { AddressSpace, PseudoSession } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { ClientRoleSet } from "node-opcua-role-set-client";
import should from "should";

describe("node-opcua-role-set-client: ClientRoleSet", () => {
    let addressSpace: AddressSpace;
    let session: PseudoSession;

    before(async function () {
        this.timeout(30000);
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://test");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        session = new PseudoSession(addressSpace);
    });

    after(() => {
        addressSpace.dispose();
    });

    describe("getRoles", () => {
        it("should return all well-known roles", async () => {
            const roleSet = new ClientRoleSet(session);
            const roles = await roleSet.getRoles();
            const names = roles.map((r) => r.roleName);
            names.should.containEql("Anonymous");
            names.should.containEql("AuthenticatedUser");
            names.should.containEql("SecurityAdmin");
            names.should.containEql("Observer");
            names.should.containEql("Engineer");
            names.should.containEql("Operator");
            names.should.containEql("ConfigureAdmin");
            names.should.containEql("Supervisor");
        });

        it("should cache the roles between calls", async () => {
            const roleSet = new ClientRoleSet(session);
            const first = await roleSet.getRoles();
            const second = await roleSet.getRoles();
            second.should.equal(first); // same cached array instance
        });
    });

    describe("getRole", () => {
        it("should resolve a role by name and read its (empty) identities", async () => {
            const roleSet = new ClientRoleSet(session);
            const secAdmin = await roleSet.getRole("SecurityAdmin");
            should.exist(secAdmin);
            const identities = await secAdmin?.readIdentities();
            identities?.should.be.an.Array();
        });

        it("should return undefined for an unknown role", async () => {
            const roleSet = new ClientRoleSet(session);
            const unknown = await roleSet.getRole("NoSuchRole");
            should.not.exist(unknown);
        });

        it("should read empty identities for the Observer role initially", async () => {
            const roleSet = new ClientRoleSet(session);
            const observer = await roleSet.getRole("Observer");
            should.exist(observer);
            (await observer?.readIdentities())?.should.have.length(0);
        });
    });

    describe("readAllRoleIdentities", () => {
        it("should return identities for all roles", async () => {
            const roleSet = new ClientRoleSet(session);
            const results = await roleSet.readAllRoleIdentities();
            results.length.should.be.greaterThan(0);
            for (const r of results) {
                r.roleName.should.be.a.String();
                r.identities.should.be.an.Array();
            }
        });
    });
});
