import * as path from "path";

import * as should from "should";

import { assert } from "node-opcua-assert";
import { DataType } from "node-opcua-variant";
import { NodeId, NodeIdType } from "node-opcua-nodeid";

import { AddressSpace, Namespace } from "..";
import { assertHasMatchingReference } from "../testHelpers";
import { generateAddressSpace } from "../nodeJS";

const nodesetFilename = path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml");

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing github issue https://github.com/node-opcua/node-opcua/issues/104", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    before(async () => {
        addressSpace = AddressSpace.create();
        namespace = addressSpace.registerNamespace("private");
        await generateAddressSpace(addressSpace, nodesetFilename);
    });
    after(async () => {
        addressSpace.dispose();
    });

    it("should not happen that node IDs are use twice", () => {
        // Create a variable with an auto-generated node ID
        const var1 = namespace.addVariable({
            browseName: "var1",
            dataType: "Double",
            organizedBy: addressSpace.rootFolder,
            value: { dataType: DataType.Double, value: 0 }
        });

        assertHasMatchingReference(var1, {
            nodeId: addressSpace.rootFolder.nodeId,
            referenceType: "OrganizedBy"
        });

        assert(var1.nodeId.identifierType === NodeIdType.NUMERIC);

        // Create two variables with the next numeric node IDs
        const var2 = namespace.addVariable({
            browseName: "var2",
            dataType: "Double",
            nodeId: new NodeId(var1.nodeId.identifierType, (var1.nodeId.value as number) + 1, var1.nodeId.namespace),
            organizedBy: addressSpace.rootFolder,
            value: { dataType: DataType.Double, value: 0 }
        });

        should(var2.nodeId.identifierType).eql(NodeIdType.NUMERIC);
        should(var2.nodeId.namespace).eql(var1.nodeId.namespace);
        should(var2.nodeId.value).eql((var1.nodeId.value as number) + 1);

        const var3 = namespace.addVariable({
            browseName: "var3",
            dataType: "Double",
            nodeId: new NodeId(var1.nodeId.identifierType, (var1.nodeId.value as number) + 2, var1.nodeId.namespace),
            organizedBy: addressSpace.rootFolder,
            value: { dataType: DataType.Double, value: 0 }
        });

        should(var3.nodeId.identifierType).eql(NodeIdType.NUMERIC);
        should(var3.nodeId.namespace).eql(var1.nodeId.namespace);
        should(var3.nodeId.value).eql((var1.nodeId.value as number) + 2);

        // Create another value with an auto-generated node ID
        // It must not have the same node ID as the second variable.
        const var4 = namespace.addVariable({
            browseName: "var4",
            dataType: "Double",
            organizedBy: addressSpace.rootFolder,
            value: { dataType: DataType.Double, value: 0 }
        });

        should(var4.nodeId.identifierType).eql(NodeIdType.NUMERIC);
        should(var4.nodeId.namespace).eql(var1.nodeId.namespace);
        should(var4.nodeId.value).eql((var1.nodeId.value as number) + 3);
    });
});
