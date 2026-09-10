import { nodesets } from "node-opcua-nodesets";
import should from "should";
import type { UAObject, UAVariable } from "../dist/api/index.js";
import { AddressSpace } from "../dist/api/index.js";
import { generateAddressSpace } from "../nodeJS.js";
import { getAddressSpaceFixture } from "../test_helpers/get_address_space_fixture.js";

/**
 * A NodeSet2 node declares its parent with `ParentNodeId`. The OPC Foundation's
 * ModelCompiler relies on it for a node reached from two parents (an add-in owned by a
 * folder and re-exposed from the type, the type's reference listed first) and for a
 * folder that is only organized, and names the node's id after that chain
 * (`DeviceType_BuildingBlocks_LifetimeCounters`). The loader used to parent a node
 * under the first aggregating reference met, and an organized folder under nothing.
 */
describe("Testing loadNodeSet - the declared ParentNodeId is the parent", function (this: Mocha.Suite) {
    this.timeout(200000);

    let addressSpace: AddressSpace;
    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard, getAddressSpaceFixture("nodeset_with_parent_node_id.xml")]);
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    it("LNPN-1 a node reached from two aggregating parents is parented by the declared one, not the first met", () => {
        const lifetimeCounters = addressSpace.findNode("ns=1;i=1002") as UAObject;
        should(lifetimeCounters.parentNodeId?.toString()).eql("ns=1;i=1001");
        const label = addressSpace.findNode("ns=1;i=1003") as UAVariable;
        should(label.parentNodeId?.toString()).eql("ns=1;i=1001");
    });

    it("LNPN-2 an organized folder is parented by its organizer, as declared", () => {
        const folder = addressSpace.findNode("ns=1;i=1001") as UAObject;
        should(folder.parentNodeId?.toString()).eql("ns=1;i=1000");
    });

    it("LNPN-3 the export writes the declared parents back", () => {
        const xml = addressSpace.getNamespace(1).toNodeset2XML();
        should(xml).match(/NodeId="ns=1;i=1002" BrowseName="1:LifetimeCounters" ParentNodeId="ns=1;i=1001"/);
        should(xml).match(/NodeId="ns=1;i=1001" BrowseName="1:BuildingBlocks" ParentNodeId="ns=1;i=1000"/);
        should(xml).match(/NodeId="ns=1;i=1003" BrowseName="1:Label" ParentNodeId="ns=1;i=1001"/);
    });

    it("LNPN-4 without a declaration, a node with a single organizing parent and no aggregating one is parented by it", () => {
        const namespace = addressSpace.getOwnNamespace();
        const holder = namespace.addObject({ browseName: "Holder", organizedBy: addressSpace.rootFolder.objects });
        const organized = namespace.addObject({ browseName: "Organized", organizedBy: holder });
        should(organized.parentNodeId?.toString()).eql(holder.nodeId.toString());
    });
});
