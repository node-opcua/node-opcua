import { AddressSpace, PseudoSession } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { nodesets } from "node-opcua-nodesets";
import { browseRoles, ClientRole, readAllRoleIdentities } from "node-opcua-role-set-client";
import should from "should";

describe("node-opcua-role-set-client", () => {
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

    describe("browseRoles", () => {
        it("should return all well-known roles", async () => {
            const roles = await browseRoles(session);
            roles.length.should.be.greaterThan(0);

            // Should contain well-known names
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
    });

    describe("ClientRole", () => {
        it("should resolve method NodeIds via translateBrowsePath", async () => {
            const roles = await browseRoles(session);
            const secAdmin = roles.find((r) => r.roleName === "SecurityAdmin");
            should(secAdmin).not.be.undefined();

            const clientRole = new ClientRole(session, secAdmin.roleNodeId);

            // readIdentities should work (returns empty initially)
            const identities = await clientRole.readIdentities();
            identities.should.be.an.Array();
        });

        it("should read empty identities initially", async () => {
            const roles = await browseRoles(session);
            const observer = roles.find((r) => r.roleName === "Observer");

            const clientRole = new ClientRole(session, observer?.roleNodeId);
            const identities = await clientRole.readIdentities();
            identities.should.have.length(0);
        });
    });

    describe("readAllRoleIdentities", () => {
        it("should return identities for all roles", async () => {
            const results = await readAllRoleIdentities(session);
            results.length.should.be.greaterThan(0);

            for (const r of results) {
                r.roleName.should.be.a.String();
                r.identities.should.be.an.Array();
            }
        });
    });
});
