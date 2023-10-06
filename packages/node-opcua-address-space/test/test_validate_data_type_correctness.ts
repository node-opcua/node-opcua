import should from "should";
import { DataType } from "node-opcua-variant";
import { nodesets } from "node-opcua-nodesets";
import { coerceInt64 } from "node-opcua-basic-types";

import { AddressSpace, UAVariable, validateDataTypeCorrectness } from "..";
import { generateAddressSpace } from "../distNodeJS";

process.env.TEST = "true";
describe("testing validateDataTypeCorrectness", () => {
    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpace.create();
        const xml_files = [nodesets.standard];
        await generateAddressSpace(addressSpace, xml_files);
        addressSpace.registerNamespace("Private");
        // Create a few variables
        const namespace = addressSpace.getOwnNamespace();

        const integerDataType = addressSpace.findDataType("Integer")!;
        if (!integerDataType) {
            throw new Error("Cannot find Integer DataType");
        }

        // custom Integer type
        const customTypeNamespace = addressSpace.registerNamespace("http://myorganisation.org/customTypes");
        const customDataType = customTypeNamespace.createDataType({
            browseName: "INT",
            subtypeOf: "Int16",
            isAbstract: false
        });

        // custom Enumeration type
        const enumeration = addressSpace.findDataType("Enumeration")!;
        const customEnum = customTypeNamespace.createDataType({
            browseName: "MyEnumeration",
            subtypeOf: enumeration,
            isAbstract: false,
            partialDefinition: [
                {
                    name: "RUNNING",
                    value: coerceInt64(1),
                    description: "The device is running"
                },
                {
                    name: "STOPPED",
                    value: coerceInt64(2),
                    description: "The device is stopped"
                }
            ]
        });
    });
    after(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });
    it("Int16: should accept a DataType.Int16 variant", async () => {
        const dataType = addressSpace.findDataType("Int16")!.nodeId;
        should.exist(dataType);
        validateDataTypeCorrectness(addressSpace, dataType, DataType.Int16, false).should.eql(true);
    });
    it("Int16: should reject a DataType.Int32 variant", async () => {
        const dataType = addressSpace.findDataType("Int16")!.nodeId;
        should.exist(dataType);
        validateDataTypeCorrectness(addressSpace, dataType, DataType.Int32, false).should.eql(false);
    });
    it("Integer: should accept a DataType.Int16 variant", async () => {
        const dataType = addressSpace.findDataType("Integer")!.nodeId;
        should.exist(dataType);
        validateDataTypeCorrectness(addressSpace, dataType, DataType.Int16, false).should.eql(true);
    });
    it("Integer: should accept a DataType.Int32 variant", async () => {
        const dataType = addressSpace.findDataType("Int16")!.nodeId;
        should.exist(dataType);
        validateDataTypeCorrectness(addressSpace, dataType, DataType.Int32, false).should.eql(false);
    });
    it("Integer: should reject a DataType.Double variant", async () => {
        const dataType = addressSpace.findDataType("Int16")!.nodeId;
        should.exist(dataType);
        validateDataTypeCorrectness(addressSpace, dataType, DataType.Double, false).should.eql(false);
    });

    it("Integer: should reject a DataType.ExtensionObject variant", async () => {
        const dataType = addressSpace.findDataType("Int16")!.nodeId;
        should.exist(dataType);
        validateDataTypeCorrectness(addressSpace, dataType, DataType.ExtensionObject, false).should.eql(false);
    });

    it("0:BrokerConnectionTransportDataType: should accept a DataType.ExtensionObject variant", async () => {
        const dataType = addressSpace.findDataType("BrokerConnectionTransportDataType")!.nodeId;
        should.exist(dataType);
        validateDataTypeCorrectness(addressSpace, dataType, DataType.ExtensionObject, false).should.eql(true);
    });
    it("0:BrokerConnectionTransportDataType: should reject a DataType.Int32 variant", async () => {
        const dataType = addressSpace.findDataType("BrokerConnectionTransportDataType")!.nodeId;
        should.exist(dataType);
        validateDataTypeCorrectness(addressSpace, dataType, DataType.Int32, false).should.eql(false);
    });

    it("custom basicType INT(int16): should accept a DataType.Int16 variant", async () => {
        const ns = addressSpace.getNamespaceIndex("http://myorganisation.org/customTypes");
        ns.should.not.eql(-1);
        const dataType = addressSpace.findDataType("INT", ns)!.nodeId;
        should.exist(dataType);
        validateDataTypeCorrectness(addressSpace, dataType, DataType.Int16, false).should.eql(true);
    });
    it("custome basicType INT(int16): should not accept a DataType.Int32 variant", async () => {
        const ns = addressSpace.getNamespaceIndex("http://myorganisation.org/customTypes");
        ns.should.not.eql(-1);
        const dataType = addressSpace.findDataType("INT", ns)!.nodeId;
        should.exist(dataType);
        validateDataTypeCorrectness(addressSpace, dataType, DataType.Int32, false).should.eql(false);
    });
    // Enum
    it("custom Enumeration: should accept a DataType.Int32 variant", async () => {
        const ns = addressSpace.getNamespaceIndex("http://myorganisation.org/customTypes");
        ns.should.not.eql(-1);
        const dataType = addressSpace.findDataType("MyEnumeration", ns)!.nodeId;
        should.exist(dataType);
        validateDataTypeCorrectness(addressSpace, dataType, DataType.Int32, false).should.eql(true);
    });
    it("custom Enumeration: should not accept a DataType.UInt32 variant", async () => {
        const ns = addressSpace.getNamespaceIndex("http://myorganisation.org/customTypes");
        ns.should.not.eql(-1);
        const dataType = addressSpace.findDataType("MyEnumeration", ns)!.nodeId;
        should.exist(dataType);
        validateDataTypeCorrectness(addressSpace, dataType, DataType.UInt32, false).should.eql(false);
    });
    it("custome Enumeration: should not accept a DataType.QualifiedName variant", async () => {
        const ns = addressSpace.getNamespaceIndex("http://myorganisation.org/customTypes");
        ns.should.not.eql(-1);
        const dataType = addressSpace.findDataType("MyEnumeration", ns)!.nodeId;
        should.exist(dataType);
        validateDataTypeCorrectness(addressSpace, dataType, DataType.QualifiedName, false).should.eql(false);
    });

    it("DataType.Null: should accept DataType.Null if allow Null", async () => {
        const ns = addressSpace.getNamespaceIndex("http://myorganisation.org/customTypes");
        ns.should.not.eql(-1);
        const dataType = addressSpace.findDataType("MyEnumeration", ns)!.nodeId;
        should.exist(dataType);
        validateDataTypeCorrectness(addressSpace, dataType, DataType.Null, true).should.eql(true);
    });
});
