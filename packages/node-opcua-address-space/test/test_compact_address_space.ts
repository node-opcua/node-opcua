import type { StoreVariableView } from "node-opcua-address-space-store";
import { AttributeIds, NodeClass } from "node-opcua-data-model";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import should from "should";
import { AddressSpace, type CompactAddressSpace } from "../dist/api/index.js";
import { generateCompactAddressSpace } from "../nodeJS.js";

describe("compact address space: AddressSpace.createCompact and the file loader", function () {
    this.timeout(60000);
    let addressSpace: CompactAddressSpace;

    before(async () => {
        addressSpace = AddressSpace.createCompact({ expectedNodes: 40000 });
        await generateCompactAddressSpace(addressSpace, [nodesets.standard, nodesets.di]);
    });

    it("loads several documents into one store", () => {
        should(addressSpace.nodeCount).be.above(5500, "the standard nodeset and DI together");
        should(addressSpace.namespaceUris).eql(["http://opcfoundation.org/UA/", "http://opcfoundation.org/UA/DI/"]);
        const deviceSet = addressSpace.findNode("ns=1;i=5001");
        should(deviceSet?.browseName.toString()).eql("1:DeviceSet");
        should(deviceSet?.nodeClass).eql(NodeClass.Object);
        should(deviceSet?.findReferences("Organizes", false)[0].node.nodeId.toString()).eql("ns=0;i=85");
    });

    it("answers reads as the object address space does", () => {
        const serverStatus = addressSpace.findNode("ns=0;i=2256");
        should(serverStatus?.readAttribute(null, AttributeIds.BrowseName).value.value.name).eql("ServerStatus");
        const currentTime = serverStatus?.getComponentByName("CurrentTime") as StoreVariableView;
        should(currentTime.readValue().statusCode).eql(StatusCodes.BadWaitingForInitialData);
        currentTime.bindVariable({ get: () => ({ dataType: DataType.DateTime, value: new Date(0) }) as never });
        should(currentTime.readValue().value.value).eql(new Date(0));
    });
});
