import { QualifiedName } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, makeRoles, WellKnownRoles } from "..";
import { generateAddressSpace } from "../nodeJS";

const GDS_NAMESPACE_URI = "http://opcfoundation.org/UA/GDS/";

const observer = resolveNodeId("WellKnownRole_Observer").toString();
const operator = resolveNodeId("WellKnownRole_Operator").toString();

describe("makeRoles - resolving Roles outside namespace 0", function (this: Mocha.Suite) {
    this.timeout(200000);

    let addressSpace: AddressSpace;
    // the GDS Roles: DiscoveryAdmin, CertificateAuthorityAdmin, RegistrationAuthorityAdmin
    let discoveryAdmin: string;
    let certificateAuthorityAdmin: string;

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.gds]);
        const gdsIndex = addressSpace.getNamespaceIndex(GDS_NAMESPACE_URI);
        gdsIndex.should.be.greaterThan(0, "expecting the GDS nodeset to be loaded");
        discoveryAdmin = `ns=${gdsIndex};i=1661`;
        certificateAuthorityAdmin = `ns=${gdsIndex};i=1680`;
    });
    after(() => {
        addressSpace.dispose();
    });

    describe("the spellings that never needed an address space", () => {
        it("MKR-1 should keep resolving a WellKnownRoles enum value", () => {
            makeRoles(WellKnownRoles.Observer).map(String).should.eql([observer]);
        });

        it("MKR-2 should keep resolving a semicolon separated list of well known names", () => {
            makeRoles("Observer;Operator").map(String).should.eql([observer, operator]);
        });

        it("MKR-3 should accept the WellKnownRole_ prefix spelling", () => {
            makeRoles("WellKnownRole_Observer").map(String).should.eql([observer]);
        });

        it("MKR-4 should keep resolving an array of NodeIdLike", () => {
            makeRoles([WellKnownRoles.Observer, "ns=1;i=1661"]).map(String).should.eql([observer, "ns=1;i=1661"]);
        });
    });

    describe("resolving by NodeId", () => {
        it("MKR-5 should resolve a NodeId given as a string, whose own semicolon used to break the split", () => {
            makeRoles(discoveryAdmin).map(String).should.eql([discoveryAdmin]);
        });

        it("MKR-6 should resolve NodeIds mixed with names in the same list", () => {
            makeRoles(`Observer;${discoveryAdmin};Operator`).map(String).should.eql([observer, discoveryAdmin, operator]);
        });

        it("MKR-7 should resolve a list made of NodeIds only", () => {
            makeRoles(`${discoveryAdmin};${certificateAuthorityAdmin}`)
                .map(String)
                .should.eql([discoveryAdmin, certificateAuthorityAdmin]);
        });

        it("MKR-8 should ignore the blanks around each element", () => {
            makeRoles(` Observer ; ${discoveryAdmin} ; `).map(String).should.eql([observer, discoveryAdmin]);
        });
    });

    describe("resolving by BrowseName through the RoleSet", () => {
        it("MKR-9 should resolve a BrowseName qualified by its namespace index", () => {
            const gdsIndex = addressSpace.getNamespaceIndex(GDS_NAMESPACE_URI);
            makeRoles(`${gdsIndex}:DiscoveryAdmin`, addressSpace).map(String).should.eql([discoveryAdmin]);
        });

        it("MKR-10 should resolve a QualifiedName carrying its namespace index", () => {
            const namespaceIndex = addressSpace.getNamespaceIndex(GDS_NAMESPACE_URI);
            makeRoles([{ namespaceIndex, name: "CertificateAuthorityAdmin" }], addressSpace)
                .map(String)
                .should.eql([certificateAuthorityAdmin]);
        });

        it("MKR-11 should resolve an unqualified BrowseName that is unambiguous", () => {
            makeRoles("DiscoveryAdmin", addressSpace).map(String).should.eql([discoveryAdmin]);
            // a QualifiedName with no namespaceIndex means "any namespace" too
            makeRoles([{ name: "DiscoveryAdmin" }], addressSpace)
                .map(String)
                .should.eql([discoveryAdmin]);
        });

        it("MKR-12 should resolve the standard Roles by BrowseName too", () => {
            makeRoles("Observer", addressSpace).map(String).should.eql([observer]);
        });

        it("MKR-13b should resolve a QualifiedName instance", () => {
            const namespaceIndex = addressSpace.getNamespaceIndex(GDS_NAMESPACE_URI);
            makeRoles([new QualifiedName({ namespaceIndex, name: "DiscoveryAdmin" })], addressSpace)
                .map(String)
                .should.eql([discoveryAdmin]);
        });

        it("MKR-13 should mix BrowseNames, NodeIds and well known names", () => {
            makeRoles(`Observer;DiscoveryAdmin;${certificateAuthorityAdmin}`, addressSpace)
                .map(String)
                .should.eql([observer, discoveryAdmin, certificateAuthorityAdmin]);
        });
    });

    describe("diagnostics", () => {
        it("MKR-14 should explain that an address space is needed for a non standard Role", () => {
            should(() => makeRoles("DiscoveryAdmin")).throw(/an address space must be passed/);
        });

        it("MKR-15 should list the known Roles when the name is unknown", () => {
            should(() => makeRoles("NoSuchRole", addressSpace)).throw(/cannot find a Role named "NoSuchRole".*Observer/);
        });

        it("MKR-16 should not resolve a Role that lives in another namespace", () => {
            // DiscoveryAdmin exists, but not in namespace 0
            should(() => makeRoles([{ namespaceIndex: 0, name: "DiscoveryAdmin" }], addressSpace)).throw(
                /cannot find a Role named "DiscoveryAdmin"/
            );
        });

        it("MKR-17 should reject a QualifiedName that carries no name", () => {
            should(() => makeRoles([{ namespaceIndex: 1, name: null }], addressSpace)).throw(/must carry a name/);
        });
    });
});
