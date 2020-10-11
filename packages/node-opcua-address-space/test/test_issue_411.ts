import { DataTypeIds } from "node-opcua-constants";
import { standardUnits } from "node-opcua-data-access";
import { DataValue } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { Variant } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";
import * as should from "should";

import { generateAddressSpace } from "../nodeJS";
import { AddressSpace } from "..";
import { Namespace } from "..";
import { SessionContext } from "..";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("#411 - AddMethod  should not changes namespace of custom datatype", () => {
    const nodesetFilename = nodesets.standard;

    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let analogItem;

    before(async () => {
        addressSpace = AddressSpace.create();
        namespace = addressSpace.registerNamespace("Private");
        namespace.index.should.eql(1);

        addressSpace.getNamespace("Private").index.should.eql((addressSpace as any)._private_namespaceIndex);

        await generateAddressSpace(addressSpace, nodesetFilename);

        const objectsFolder = addressSpace.findNode("ObjectsFolder")!;

        analogItem = namespace.addAnalogDataItem({
            browseName: "TemperatureSensor",
            dataType: "Double",
            definition: "(tempA -25) + tempB",
            engineeringUnits: standardUnits.degree_celsius,
            engineeringUnitsRange: { low: -2000, high: 2000 },
            instrumentRange: { low: -100, high: 200 },
            organizedBy: objectsFolder,
            value: new Variant({ dataType: DataType.Double, value: 10.0 }),
            valuePrecision: 0.5
        });
    });
    after(async () => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("should verify that addMethod doesn't mess up with dataType namespace", () => {
        // create a custom DataType ( derived from String )
        const dataType = namespace.createDataType({
            browseName: "MyCustomString",
            isAbstract: false,
            subtypeOf: "String"
        });

        const myCustomStringDataType = addressSpace.findDataType("1:MyCustomString")!;

        should.exist(myCustomStringDataType);
        myCustomStringDataType.nodeId.namespace.should.not.eql(0, "namespace should not be zero for this test");

        const device = namespace.addObject({
            browseName: "Devices",
            organizedBy: addressSpace.rootFolder.objects
        });

        const method = namespace.addMethod(device, {
            browseName: "SomeMethod",
            inputArguments: [
                {
                    dataType: myCustomStringDataType.nodeId,
                    description: { text: "arg1 should be a MyCustomString DataType" },
                    name: "arg1",
                    valueRank: -1
                }
            ],
            outputArguments: []
        });

        const inputArguments = method.inputArguments!.readValue().value.value;

        inputArguments[0].constructor.name.should.eql("Argument");
        inputArguments[0].dataType
            .toString()
            .should.eql(myCustomStringDataType.nodeId.toString(), "nodeid and namespace should match");
    });
});
