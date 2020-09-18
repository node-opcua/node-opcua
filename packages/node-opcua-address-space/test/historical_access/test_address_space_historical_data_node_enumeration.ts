import * as fs from "fs";
import * as nodesets from "node-opcua-nodesets";
import * as should from "should";
import * as _ from "underscore";

import { AddressSpace, SessionContext } from "../..";
import { generateAddressSpace } from "../../nodeJS";

const context = SessionContext.defaultContext;

// tslint:disable-next-line:no-var-requires
require("date-utils");

// make sure extra error checking is made on object constructions
// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing Historical Data Node Enumeration", () => {
    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpace.create();
        const xml_files = [nodesets.standard_nodeset_file];
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
        Object.keys(addressSpace.historizingNodes).length.should.eql(3);
        const historizingNode = _.map(addressSpace.historizingNodes, (x: any) => x);
        historizingNode.map((x: any) => x.browseName.toString()).should.eql(["1:MyVar1", "1:MyVar2", "1:MyVar3"]);
    });
});
