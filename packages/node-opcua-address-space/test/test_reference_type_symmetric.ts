import { AttributeIds } from "node-opcua-data-model";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import type { UAReferenceType } from "../dist/api/index.js";
import { AddressSpace } from "../dist/api/index.js";
import { generateAddressSpace } from "../nodeJS.js";
import { getAddressSpaceFixture } from "../test_helpers/get_address_space_fixture.js";

/**
 * A ReferenceType's Symmetric attribute comes from the NodeSet2 document. The reader dropped it, so
 * every type loaded from XML (the standard References among them) read Symmetric = false, and the
 * writer guessed it back from a missing InverseName, which turned a non-symmetric type that gives
 * no InverseName into a symmetric one.
 */
describe("Testing loadNodeSet - the Symmetric attribute of a ReferenceType", function (this: Mocha.Suite) {
    this.timeout(200000);

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [
            nodesets.standard,
            getAddressSpaceFixture("nodeset_with_symmetric_reference_types.xml")
        ]);
    });
    after(() => {
        addressSpace.dispose();
    });

    const symmetricAttribute = (nodeId: string) =>
        (addressSpace.findNode(nodeId) as UAReferenceType).readAttribute(null, AttributeIds.Symmetric).value.value;

    it("RTS-1 the Symmetric attribute is read from the document", () => {
        should(symmetricAttribute("ns=1;i=4001")).eql(true);
        should(symmetricAttribute("ns=1;i=4002")).eql(false);
        should(symmetricAttribute("ns=1;i=4003")).eql(false);
    });

    it("RTS-2 the standard References type is symmetric, HierarchicalReferences is not", () => {
        should(symmetricAttribute("i=31")).eql(true);
        should(symmetricAttribute("i=33")).eql(false);
    });

    it("RTS-3 the export writes back what the document said, and only that", () => {
        const xml = addressSpace.getNamespace(1).toNodeset2XML();
        const element = (nodeId: string) =>
            new RegExp(`<UAReferenceType NodeId="${nodeId}"[^>]*>[^]*?</UAReferenceType>`).exec(xml)?.[0] ?? "";
        should(element("ns=1;i=4001")).match(/Symmetric="true"/);
        should(element("ns=1;i=4001")).not.match(/<InverseName>/);
        should(element("ns=1;i=4002")).not.match(/Symmetric=|<InverseName>/);
        should(element("ns=1;i=4003")).not.match(/Symmetric=/);
        should(element("ns=1;i=4003")).match(/<InverseName>IsWidgetOf<\/InverseName>/);
    });

    it("RTS-4 through the API, a type given neither symmetric nor an inverse name stays symmetric", () => {
        const namespace = addressSpace.getOwnNamespace();
        const bare = namespace.addReferenceType({ browseName: "Bare", inverseName: "", subtypeOf: "NonHierarchicalReferences" });
        should(bare.symmetric).eql(true);
        const named = namespace.addReferenceType({
            browseName: "HasNamed",
            inverseName: "IsNamedOf",
            subtypeOf: "NonHierarchicalReferences"
        });
        should(named.symmetric).eql(false);
    });
});
