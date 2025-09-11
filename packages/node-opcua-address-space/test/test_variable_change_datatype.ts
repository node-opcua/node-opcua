
import "should";
import { DataType, Variant } from "node-opcua-variant";
import { resolveNodeId } from "node-opcua-nodeid";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

import { AddressSpace, SessionContext, UADataType, UAVariable } from "..";
import { getMiniAddressSpace } from "../testHelpers";

const doDebug = false;

const context = SessionContext.defaultContext;

describe("testing UAVariable -  change datatype", () => {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
    });
    after(async () => {
        addressSpace.dispose();
    });
    it("CDT-1 should be possible to change the dataType of an existing variable", () => {
        const namespace = addressSpace.getOwnNamespace();

        const uaVariable = namespace.addVariable({
            browseName: "MyVariable",
            dataType: "Double",
            organizedBy: addressSpace.rootFolder.objects
        });

        uaVariable.dataType.should.eql(resolveNodeId(DataType.Double));
        uaVariable.setValueFromSource({ dataType: "Double", value: 3.14 });
        uaVariable.readValue().value.value.should.eql(3.14);


        // Change data type to Int32
        uaVariable.changeDataType("Int32", { dataType: DataType.Int32, value: 3 });

        uaVariable.dataType.should.eql(resolveNodeId(DataType.Int32));

        uaVariable.readValue().value.value.should.eql(3);
        uaVariable.readValue().value.dataType.should.eql(DataType.Int32);
        uaVariable.dataType.toString().should.eql(resolveNodeId(DataType.Int32).toString());
    });

    it("CDT-2 should be possible to change the dataType of an existing variable", () => {
        const namespace = addressSpace.getOwnNamespace();

        const uaDevice = namespace.addObject({
            browseName: "MyDevice",
            organizedBy: addressSpace.rootFolder.objects
        });

        const uaVariable = namespace.addVariable({
            componentOf: uaDevice,
            browseName: "MyVariable",
            nodeId: "s=MyVariable",
            dataType: "Double"
        });
        uaVariable.setValueFromSource({ dataType: DataType.Double, value: 0.0 });

        doDebug && console.log(uaVariable.readValue().toString());

        // Change data type to Int32
        uaVariable.changeDataType(DataType.UInt32, { dataType: DataType.UInt32, value: 42 });
        uaVariable.readValue().value.value.should.eql(42);
        uaVariable.readValue().value.dataType.should.eql(DataType.UInt32);
        uaVariable.dataType.toString().should.eql(resolveNodeId(DataType.UInt32).toString());
        doDebug && console.log(uaVariable.readValue().toString());

        // Change data type to String
        uaVariable.changeDataType(DataType.String, new Variant({ dataType: "String", value: "Hello World" }));
        uaVariable.readValue().value.value.should.eql("Hello World");
        uaVariable.readValue().value.dataType.should.eql(DataType.String);
        uaVariable.dataType.toString().should.eql(resolveNodeId(DataType.String).toString());
        doDebug && console.log(uaVariable.readValue().toString());

    });
});
