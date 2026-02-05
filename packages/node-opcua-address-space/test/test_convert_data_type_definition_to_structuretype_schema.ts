
import should from "should";
import path from "path";
import { AttributeIds } from "node-opcua-data-model";
import { StatusCodes } from "node-opcua-status-code";
import { StructureDefinition } from "node-opcua-types";

import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, PseudoSession, SessionContext } from "..";
import { generateAddressSpace } from "../nodeJS";

import { convertDataTypeDefinitionToStructureTypeSchema, ExtraDataTypeManager } from "node-opcua-client-dynamic-extension-object";
import { DataTypeIds } from "../../node-opcua-constants/dist";
import { coerceNodeId } from "node-opcua-nodeid";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { DataTypeFactory, getStandardDataTypeFactory } from "node-opcua-factory";


describe("convertDataTypeDefinitionToStructureTypeSchema", () => {
    let addressSpace: AddressSpace;
    let dataTypeManager: ExtraDataTypeManager;
    before(async () => {
        addressSpace = AddressSpace.create();
        
        addressSpace.registerNamespace("PRIVATE");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        dataTypeManager = new ExtraDataTypeManager();
        const dataTypeFactory1 = new DataTypeFactory([getStandardDataTypeFactory()]);
        dataTypeManager.registerDataTypeFactory(1, dataTypeFactory1);
    });
    after(async () => {
        addressSpace.dispose();
    });

    it("should convert a simple structure data type", async () => {
        const ns = addressSpace.getOwnNamespace();
 
        const myStructure = ns.createDataType({
            browseName: "MyStructure",
            isAbstract: false,
            subtypeOf: "Structure",
            partialDefinition: [
                {
                    dataType: coerceNodeId(DataTypeIds.Double),
                    description: "the first value",
                    name: "Value1",
                    valueRank: -1
                },
                {
                    dataType: coerceNodeId(DataTypeIds.String),
                    description: "the second value",
                    name: "Value2",
                    valueRank: -1
                }
            ]
        });

        const dataTypeDefinitionDataValue = myStructure.readAttribute(null, AttributeIds.DataTypeDefinition);
        should.exist(dataTypeDefinitionDataValue);
        dataTypeDefinitionDataValue.statusCode.should.eql(StatusCodes.Good);

        const definition = dataTypeDefinitionDataValue.value.value as StructureDefinition;
        should.exist(definition);

        const psseudoSession = new PseudoSession(addressSpace);
        const schema = await convertDataTypeDefinitionToStructureTypeSchema(
            psseudoSession,
            myStructure.nodeId,
            "MyStructure",
            definition,
            null,
            dataTypeManager,
            false,
            {}
        );

        should.exist(schema);
        schema.name.should.eql("MyStructure");
        schema.fields.length.should.eql(2);
        schema.fields[0].name.should.eql("value1");
        schema.fields[0].fieldType.should.eql("Double");
        schema.fields[1].name.should.eql("value2");
        schema.fields[1].fieldType.should.eql("String");
    });

    it("should convert a data type with an enumeration", async () => {

        const ns = addressSpace.getOwnNamespace();

        const myEnum = ns.addEnumerationType({
            browseName: "MyEnum",
            enumeration: ["Red", "Green", "Blue"]
        });

        const myStructureWithEnum = ns.createDataType({
            browseName: "MyStructureWithEnum",
            isAbstract: false,
            subtypeOf: "Structure",
            partialDefinition: [
                {
                    dataType: myEnum.nodeId,
                    description: "the enum value",
                    name: "EnumValue",
                    valueRank: -1
                }
            ]
        });

        const dataTypeDefinitionDataValue = myStructureWithEnum.readAttribute(null, AttributeIds.DataTypeDefinition);
        should.exist(dataTypeDefinitionDataValue);
        dataTypeDefinitionDataValue.statusCode.should.eql(StatusCodes.Good);

        const definition = dataTypeDefinitionDataValue.value.value as StructureDefinition;
        should.exist(definition);

        const psseudoSession = new PseudoSession(addressSpace);

        const schema = await convertDataTypeDefinitionToStructureTypeSchema(
            psseudoSession,
            myStructureWithEnum.nodeId,
            "MyStructureWithEnum",
            definition,
            null,
            dataTypeManager,
            false,
            {}
        );

        should.exist(schema);
        schema.name.should.eql("MyStructureWithEnum");
        schema.fields.length.should.eql(1);
        schema.fields[0].name.should.eql("enumValue");
        schema.fields[0].fieldType.should.eql("MyEnum");
    });


    it("should convert a data type with two enumeration fields", async () => {

        const ns = addressSpace.getOwnNamespace();

        const myEnum = ns.addEnumerationType({
            browseName: "MyEnum2",
            enumeration: ["Red", "Green", "Blue"]
        });

        const myStructureWithEnum1 = ns.createDataType({
            browseName: "MyStructureWith2Enum1",
            isAbstract: false,
            subtypeOf: "Structure",
            partialDefinition: [
                {
                    dataType: myEnum.nodeId,
                    description: "the enum value",
                    name: "EnumValue1",
                    valueRank: -1
                },
                {
                    dataType: myEnum.nodeId,
                    description: "the enum value",
                    name: "EnumValue2",
                    valueRank: -1
                },
            ]
        });
        const myStructureWithEnum2= ns.createDataType({
            browseName: "MyStructureWith2Enum2",
            isAbstract: false,
            subtypeOf: "Structure",
            partialDefinition: [
                {
                    dataType: myEnum.nodeId,
                    description: "the enum value",
                    name: "EnumValue1",
                    valueRank: -1
                },
                {
                    dataType: myEnum.nodeId,
                    description: "the enum value",
                    name: "EnumValue2",
                    valueRank: -1
                },
            ]
        });
        const dataTypeDefinitionDataValue = myStructureWithEnum1.readAttribute(null, AttributeIds.DataTypeDefinition);
        should.exist(dataTypeDefinitionDataValue);
        dataTypeDefinitionDataValue.statusCode.should.eql(StatusCodes.Good);

        const definition = dataTypeDefinitionDataValue.value.value as StructureDefinition;
        should.exist(definition);

        const pseudoSession = new PseudoSession(addressSpace);

        const schema = await convertDataTypeDefinitionToStructureTypeSchema(
            pseudoSession,
            myStructureWithEnum1.nodeId,
            "MyStructureWith2Enum1",
            definition,
            null,
            dataTypeManager,
            false,
            {}
        );

        should.exist(schema);
        schema.name.should.eql("MyStructureWith2Enum1");
        schema.fields.length.should.eql(2);
        schema.fields[0].name.should.eql("enumValue1");
        schema.fields[0].fieldType.should.eql("MyEnum2");
        schema.fields[1].name.should.eql("enumValue2");
        schema.fields[1].fieldType.should.eql("MyEnum2");


        const schema2 = await convertDataTypeDefinitionToStructureTypeSchema(
            pseudoSession,
            myStructureWithEnum1.nodeId,
            "MyStructureWith2Enum2",
            definition,
            null,
            dataTypeManager ,
            false,
            {}
        );

        should.exist(schema2);
        schema2.name.should.eql("MyStructureWith2Enum2");
        schema2.fields.length.should.eql(2);
        schema2.fields[0].name.should.eql("enumValue1");
        schema2.fields[0].fieldType.should.eql("MyEnum2");
        schema2.fields[1].name.should.eql("enumValue2");
        schema2.fields[1].fieldType.should.eql("MyEnum2");
    });
});

describe("convertDataTypeDefinitionToStructureTypeSchema", () => {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
    });
    after(async () => {
        addressSpace.dispose();
    });
    it("ZZZ should load a enum referenced twice", async()=>{
        addressSpace.registerNamespace("PRIVATE");

        const xml_file2 = path.join(__dirname, "../test_helpers/test_fixtures/datatype_enum2.xml");
        const xml_files = [nodesets.standard, xml_file2];
        
        await generateAddressSpace(addressSpace, xml_files);

        const d = addressSpace.findDataType("2:RunInfoDataType");
        should.exist(d);
    });

});
