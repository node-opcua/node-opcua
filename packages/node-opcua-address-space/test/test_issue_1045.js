const { BrowseDescription } = require("node-opcua-service-browse");
const { ReferenceTypeIds } = require("node-opcua-constants");
const { BrowseDirection, NodeClassMask } = require("node-opcua-data-model");
const { DataType } = require("node-opcua-variant");
const { AddressSpace } = require("..");
const { getMiniAddressSpace } = require("../distHelpers");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing issue 1045", () => {
    it("should browse a node with referenceTypeId: ReferenceTypeIds.References", async () => {
        const addressSpace = await getMiniAddressSpace();

        const namespace = addressSpace.getDefaultNamespace();
        const testFolder = namespace.addObject({
            browseName: "TestFolder",
            organizedBy: addressSpace.rootFolder.objects
        });

        const testVariable = namespace.addVariable({
            browseName: "TestVariable1",
            nodeId: "s=TestVariable1",
            dataType: DataType.Boolean,
            componentOf: testFolder
        });

        const browseDescription = new BrowseDescription({
            nodeId: testVariable.nodeId,
            nodeClassMask: 0,
            browseDirection: BrowseDirection.Both,
            includeSubtypes: true,
            resultMask: 0x3f,
            referenceTypeId: ReferenceTypeIds.References
        });
        const browseResult = testVariable.browseNode(browseDescription);

        console.log(browseDescription.toString());
        console.log(browseResult.toString());

        addressSpace.dispose();
    });
});
