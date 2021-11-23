import { nodesets } from "node-opcua-nodesets";
import { StructureDefinition, StructureType } from "node-opcua-types";
import { DataType } from "node-opcua-variant";

import { AddressSpace, dumpToBSD } from "..";
import { generateAddressSpace } from "../nodeJS";

describe("converting DataType to BSD schema files", () => {
    let addressSpace: AddressSpace;
    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        const nodesetFilename = [nodesets.standard];
        await generateAddressSpace(addressSpace, nodesetFilename);
        addressSpace.registerNamespace("PRIVATE");
    });
    afterEach(async () => {
        addressSpace.dispose();
    });

    it("BSD1- should convert a DataType to a schema file", () => {
        const namespace = addressSpace.getOwnNamespace();
        const dataType = namespace.createDataType({
            browseName: "MyDataType",
            isAbstract: true,
            subtypeOf: "Structure"
        });
        const xml = dumpToBSD(namespace);
        // tslint:disable-next-line: no-console
        // console.log(xml);
        xml.should.eql(`<?xml version="1.0"?>
<opc:TypeDictionary xmlns:opc="http://opcfoundation.org/BinarySchema/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:ua="http://opcfoundation.org/UA/" xmlns:n1="PRIVATE" DefaultByteOrder="LittleEndian" TargetNamespace="PRIVATE">
    <opc:StructuredType Name="MyDataType" BaseType="ua:ExtensionObject"/>
</opc:TypeDictionary>`);
    });
    it("BSD2- structure 1", async () => {

        const partialDefinition = [
            {
                dataType: DataType.String,
                description: "the name",
                isOptional: false,
                name: "Name",
                valueRank: -1
            },
            {
                arrayDimensions: [1],
                dataType: DataType.Float,
                description: "the list of values",
                name: "Values",
                valueRank: 1
            }
        ];
        const namespace = addressSpace.getOwnNamespace();
        const dataType = namespace.createDataType({
            browseName: "MyDataType",
            isAbstract: true,
            subtypeOf: "Structure",
            partialDefinition
        });

       //  const definition = namespace.getStructureDefinition();

        const xml = dumpToBSD(namespace);
        // tslint:disable-next-line: no-console
        // console.log(xml);
        xml.should.eql(`<?xml version="1.0"?>
<opc:TypeDictionary xmlns:opc="http://opcfoundation.org/BinarySchema/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:ua="http://opcfoundation.org/UA/" xmlns:n1="PRIVATE" DefaultByteOrder="LittleEndian" TargetNamespace="PRIVATE">
    <opc:StructuredType Name="MyDataType" BaseType="ua:ExtensionObject">
        <opc:Field Name="Name" TypeName="opc:String"/>
        <opc:Field Name="NoOfValues" TypeName="opc:Int32"/>
        <opc:Field Name="Values" TypeName="opc:Float" LengthField="NoOfValues"/>
    </opc:StructuredType>
</opc:TypeDictionary>`);
    });
    it("BSD3 - Enumeration ", async () => {
        const namespace = addressSpace.getOwnNamespace();

        namespace.addEnumerationType({
            browseName: "MyEnumType2",
            enumeration: ["RUNNING", "BLOCKED", "IDLE", "UNDER MAINTENANCE"]
        });

        const xml = dumpToBSD(namespace);
        // tslint:disable-next-line: no-console
        // console.log(xml);
        xml.should.eql(`<?xml version="1.0"?>
<opc:TypeDictionary xmlns:opc="http://opcfoundation.org/BinarySchema/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:ua="http://opcfoundation.org/UA/" xmlns:n1="PRIVATE" DefaultByteOrder="LittleEndian" TargetNamespace="PRIVATE">
    <opc:EnumeratedType Name="MyEnumType2" LengthInBits="32">
        <opc:EnumeratedValue Name="RUNNING" Value="0"/>
        <opc:EnumeratedValue Name="BLOCKED" Value="1"/>
        <opc:EnumeratedValue Name="IDLE" Value="2"/>
        <opc:EnumeratedValue Name="UNDER MAINTENANCE" Value="3"/>
    </opc:EnumeratedType>
</opc:TypeDictionary>`);
    });
    it("BSD4- structure 2", async () => {
        const namespace = addressSpace.getOwnNamespace();

        
        const partialDefinition =  [
            {
                dataType: DataType.String,
                description: "the name",
                isOptional: false,
                name: "Name",
                valueRank: -1
            },
            {
                arrayDimensions: [1],
                dataType: DataType.NodeId,
                description: "the list of NodeId",
                name: "Values",
                valueRank: 1
            }
        ];
        
        const dataType = namespace.createDataType({
            browseName: "MyDataType",
            isAbstract: true,
            subtypeOf: "Structure",
            partialDefinition
        });
        const dataTypeEx = namespace.createDataType({
            browseName: "MyDataTypeEx",
            isAbstract: true,
            subtypeOf: dataType.nodeId, 
            partialDefinition: [
                {
                    dataType: DataType.LocalizedText,
                    description: "extra prop",
                    isOptional: false,
                    name: "Extra",
                    valueRank: -1
                }
            ]
        });

       
            
        const xml = dumpToBSD(namespace);
        // tslint:disable-next-line: no-console
        // console.log(xml);
        xml.should.eql(`<?xml version="1.0"?>
<opc:TypeDictionary xmlns:opc="http://opcfoundation.org/BinarySchema/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:ua="http://opcfoundation.org/UA/" xmlns:n1="PRIVATE" DefaultByteOrder="LittleEndian" TargetNamespace="PRIVATE">
    <opc:StructuredType Name="MyDataType" BaseType="ua:ExtensionObject">
        <opc:Field Name="Name" TypeName="opc:String"/>
        <opc:Field Name="NoOfValues" TypeName="opc:Int32"/>
        <opc:Field Name="Values" TypeName="ua:NodeId" LengthField="NoOfValues"/>
    </opc:StructuredType>
    <opc:StructuredType Name="MyDataTypeEx" BaseType="n1:MyDataType">
        <opc:Field Name="Extra" TypeName="ua:LocalizedText"/>
    </opc:StructuredType>
</opc:TypeDictionary>`);
    });
    it("BSD5 - Opaque", async () => {
        /* to do :
            <opc: OpaqueType Name = "AudioDataType">
            </opc:OpaqueType>
        */
    });
    it("BSD6 - WithOptionalValue", async () => {
        /*
         <opc:StructuredType Name="DataValue">
            <opc:Documentation>A value with an associated timestamp, and quality.</opc:Documentation>
            <opc:Field Name="ValueSpecified" TypeName="opc:Bit" />
            <opc:Field Name="StatusCodeSpecified" TypeName="opc:Bit" />
            <opc:Field Name="SourceTimestampSpecified" TypeName="opc:Bit" />
            <opc:Field Name="ServerTimestampSpecified" TypeName="opc:Bit" />
            <opc:Field Name="SourcePicosecondsSpecified" TypeName="opc:Bit" />
            <opc:Field Name="ServerPicosecondsSpecified" TypeName="opc:Bit" />
            <opc:Field Name="Reserved1" TypeName="opc:Bit" Length="2" />
            <opc:Field Name="Value" TypeName="ua:Variant" SwitchField="ValueSpecified" />
            <opc:Field Name="StatusCode" TypeName="ua:StatusCode" SwitchField="StatusCodeSpecified" />
            <opc:Field Name="SourceTimestamp" TypeName="opc:DateTime" SwitchField="SourceTimestampSpecified" />
            <opc:Field Name="SourcePicoseconds" TypeName="opc:UInt16" SwitchField="SourcePicosecondsSpecified" />
            <opc:Field Name="ServerTimestamp" TypeName="opc:DateTime" SwitchField="ServerTimestampSpecified" />
            <opc:Field Name="ServerPicoseconds" TypeName="opc:UInt16" SwitchField="ServerPicosecondsSpecified" />
          </opc:StructuredType>
        */
        const namespace = addressSpace.getOwnNamespace();
        const dataType = namespace.createDataType({
            browseName: "MyDataWithSwitch",
            isAbstract: true,
            subtypeOf: "Structure",
            partialDefinition: [
                {
                    dataType: DataType.String,
                    description: "OptionalName",
                    isOptional: true,
                    name: "OptionalName",
                    valueRank: -1
                },
                {
                    arrayDimensions: [1],
                    dataType: DataType.NodeId,
                    description: "Optional list of NodeId",
                    isOptional: true,
                    name: "Values",
                    valueRank: 1
                }
            ]
        });

        const xml = dumpToBSD(namespace);
        // tslint:disable-next-line: no-console
        // console.log(xml);
        xml.should.eql(`<?xml version="1.0"?>
<opc:TypeDictionary xmlns:opc="http://opcfoundation.org/BinarySchema/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:ua="http://opcfoundation.org/UA/" xmlns:n1="PRIVATE" DefaultByteOrder="LittleEndian" TargetNamespace="PRIVATE">
    <opc:StructuredType Name="MyDataWithSwitch" BaseType="ua:ExtensionObject">
        <opc:Field Name="OptionalNameSpecified" TypeName="opc:Bit"/>
        <opc:Field Name="ValuesSpecified" TypeName="opc:Bit"/>
        <opc:Field Name="Reserved1" TypeName="opc:Bit" Length="30"/>
        <opc:Field Name="OptionalName" TypeName="opc:String" SwitchField="OptionalNameSpecified"/>
        <opc:Field Name="NoOfValues" TypeName="opc:Int32" SwitchField="ValuesSpecified"/>
        <opc:Field Name="Values" TypeName="ua:NodeId" LengthField="NoOfValues" SwitchField="ValuesSpecified"/>
    </opc:StructuredType>
</opc:TypeDictionary>`);
    });
});
