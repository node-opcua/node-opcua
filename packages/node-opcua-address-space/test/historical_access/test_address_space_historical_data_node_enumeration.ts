import * as fs from "fs";
import { nodesets } from "node-opcua-nodesets";
import * as should from "should";

import { AddressSpace, SessionContext } from "../..";
import { generateAddressSpace } from "../../nodeJS";

// make sure extra error checking is made on object constructions
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing Historical Data Node Enumeration", () => {
    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpace.create();
        const xml_files = [nodesets.standard];
        fs.existsSync(xml_files[0]).should.be.eql(true, "file " + xml_files[0] + " must exist");
        await generateAddressSpace(addressSpace, xml_files);

        const namespace = addressSpace.registerNamespace("MyPrivateNamespace");
        namespace.namespaceUri.should.eql("MyPrivateNamespace");

        // create historical data nodes ...

        const node1 = namespace.addVariable({
            browseName: "MyVar1",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo,
            dataType: "Double"
        });
        addressSpace.installHistoricalDataNode(node1);

        const node2 = namespace.addVariable({
            browseName: "MyVar2",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo,
            dataType: "Double"
        });
        addressSpace.installHistoricalDataNode(node2);

        const node3 = namespace.addVariable({
            browseName: "MyVar3",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo,
            dataType: "Double"
        });
        addressSpace.installHistoricalDataNode(node3);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should be easy to enumerate  UAVariable with History from a addressSpace", () => {
        const historizingNode = Object.values(addressSpace.historizingNodes || {});
        historizingNode.length.should.eql(3);
        historizingNode.map((x) => x.browseName.toString()).should.eql(["1:MyVar1", "1:MyVar2", "1:MyVar3"]);
    });
});
