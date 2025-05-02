import "should";
import should from "should";
import { DataTypeFactory } from "node-opcua-factory";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { DataTypeAndEncodingId, parseBinaryXSD } from "node-opcua-schemas";
import { MockProvider } from "node-opcua-schemas/test/mock_id_provider";
import { StructureType } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import { convertStructureTypeSchemaToStructureDefinition } from "node-opcua-client-dynamic-extension-object";

const idProvider = new MockProvider();
const doDebug = false;

describe("test convertStructureTypeSchemaToStructureDefinition", function () {
    it("should convert a structure type schema to structure definition", async () => {
        /**
         *
         */
        const schema1 = `
<?xml version="1.0" encoding="utf-8"?>
<opc:TypeDictionary xmlns:opc="http://opcfoundation.org/BinarySchema/" TargetNamespace="urn:eclipse:milo:opcua:server:demo" DefaultByteOrder="LittleEndian">
<opc:Import Namespace="http://opcfoundation.org/BinarySchema/"/>
<opc:EnumeratedType LengthInBits="32" Name="CustomEnumType">
    <opc:EnumeratedValue Name="Field0" Value="0"/>
    <opc:EnumeratedValue Name="Field1" Value="1"/>
    <opc:EnumeratedValue Name="Field2" Value="2"/>
</opc:EnumeratedType>
<opc:StructuredType Name="CustomUnionType">
    <opc:Field Name="SwitchField" TypeName="opc:UInt32"/>
    <opc:Field Name="foo" TypeName="opc:UInt32" SwitchField="SwitchField" SwitchValue="1"/>
    <opc:Field Name="bar" TypeName="opc:String" SwitchField="SwitchField" SwitchValue="2"/>
</opc:StructuredType>
<opc:StructuredType Name="CustomStructType">
    <opc:Field Name="foo" TypeName="opc:String"/>
    <opc:Field Name="bar" TypeName="opc:UInt32"/>
    <opc:Field Name="baz" TypeName="opc:Boolean"/>
    <opc:Field Name="fiz" TypeName="CustomEnumType"/>
    <opc:Field Name="poc" TypeName="CustomUnionType"/>
</opc:StructuredType>
<opc:StructuredType BaseType="ua:ExtensionObject" Name="StructWithOnlyOptionals">
    <opc:Field TypeName="opc:Bit" Name="OptionalInt32Specified"/>
    <opc:Field TypeName="opc:Bit" Name="OptionalStringArraySpecified"/>
    <opc:Field Length="30" TypeName="opc:Bit" Name="Reserved1"/>
    <opc:Field SwitchField="OptionalInt32Specified" TypeName="opc:Int32" Name="OptionalInt32"/>
    <opc:Field SwitchField="OptionalStringArraySpecified" TypeName="opc:Int32" Name="NoOfOptionalStringArray"/>
    <opc:Field SwitchField="OptionalStringArraySpecified" LengthField="NoOfOptionalStringArray" TypeName="opc:CharArray" Name="OptionalStringArray"/>
</opc:StructuredType>
<opc:StructuredType BaseType="ua:ExtensionObject" Name="StructureWithOptionalFields">
    <opc:Field TypeName="opc:Bit" Name="OptionalInt32Specified"/>
    <opc:Field TypeName="opc:Bit" Name="OptionalStringArraySpecified"/>
    <opc:Field Length="30" TypeName="opc:Bit" Name="Reserved1"/>
    <opc:Field TypeName="opc:Int32" Name="MandatoryInt32"/>
    <opc:Field SwitchField="OptionalInt32Specified" TypeName="opc:Int32" Name="OptionalInt32"/>
    <opc:Field TypeName="opc:Int32" Name="NoOfMandatoryStringArray"/>
    <opc:Field LengthField="NoOfMandatoryStringArray" TypeName="opc:CharArray" Name="MandatoryStringArray"/>
    <opc:Field SwitchField="OptionalStringArraySpecified" TypeName="opc:Int32" Name="NoOfOptionalStringArray"/>
    <opc:Field LengthField="NoOfOptionalStringArray" SwitchField="OptionalStringArraySpecified" TypeName="opc:CharArray" Name="OptionalStringArray"/>
</opc:StructuredType>

</opc:TypeDictionary>
`;

        const dataTypeFactory = new DataTypeFactory([]);
        await parseBinaryXSD(schema1, idProvider, dataTypeFactory);

        for (const f of dataTypeFactory.getStructureIterator()) {
            const ss = convertStructureTypeSchemaToStructureDefinition(f.schema);
        }

        // --------------------------------------------------------------------------
        const a = dataTypeFactory.getStructureInfoByTypeName("CustomUnionType");
        const customUnionType = convertStructureTypeSchemaToStructureDefinition(a.schema);
        doDebug && console.log(customUnionType.toString());

        customUnionType.structureType.should.eql(StructureType.Union);
        customUnionType.baseDataType.toString().should.eql("ns=0;i=0");

        customUnionType.fields!.length.should.eql(2);

        customUnionType.fields![0].name!.should.eql("foo");
        customUnionType.fields![0].dataType.toString().should.eql(resolveNodeId(DataType.UInt32).toString());
        customUnionType.fields![0].valueRank.should.eql(-1);
        customUnionType.fields![0].arrayDimensions!.should.eql([]);
        customUnionType.fields![1].isOptional.should.eql(false);
        should(customUnionType.fields![0].description.text).eql(null);

        customUnionType.fields![1].name!.should.eql("bar");
        customUnionType.fields![1].dataType.toString().should.eql(resolveNodeId(DataType.String).toString());
        customUnionType.fields![1].valueRank.should.eql(-1);
        customUnionType.fields![1].arrayDimensions!.should.eql([]);
        customUnionType.fields![1].isOptional.should.eql(false);
        should(customUnionType.fields![1].description.text).eql(null);

        // ----------------------------------------------------------------------- CustomStructType
        const b = dataTypeFactory.getStructureInfoByTypeName("CustomStructType");
        const customStructType = convertStructureTypeSchemaToStructureDefinition(b.schema);
        doDebug && console.log(customStructType.toString());

        customStructType.structureType.should.eql(StructureType.Structure);
        customStructType.baseDataType.toString().should.eql("ns=0;i=0");

        customStructType.fields!.length.should.eql(5);

        customStructType.fields![0].name!.should.eql("foo");
        customStructType.fields![0].dataType.toString().should.eql(resolveNodeId("String").toString());
        customStructType.fields![1].name!.should.eql("bar");
        customStructType.fields![1].dataType.toString().should.eql(resolveNodeId("UInt32").toString());
        customStructType.fields![2].name!.should.eql("baz");
        customStructType.fields![2].dataType.toString().should.eql(resolveNodeId("Boolean").toString());
        customStructType.fields![3].name!.should.eql("fiz");
        customStructType.fields![3].dataType.toString().should.eql("ns=0;i=0".toString());
        customStructType.fields![4].name!.should.eql("poc");
        customStructType.fields![4].dataType.toString().should.eql("ns=1;i=1".toString());
    });

    it("should convert a enumeration with unicode characters", async () => {
        /**
         *
         */
        const schema1 = `
<?xml version="1.0" encoding="utf-8"?>
<opc:TypeDictionary xmlns:opc="http://opcfoundation.org/BinarySchema/" TargetNamespace="urn:eclipse:milo:opcua:server:demo" DefaultByteOrder="LittleEndian">
<opc:Import Namespace="http://opcfoundation.org/BinarySchema/"/>
 <opc:EnumeratedType LengthInBits="32" Name="MyEnumeration">
  <opc:EnumeratedValue Name="丸" Value="1"/>
  <opc:EnumeratedValue Name="角" Value="2"/>
  <opc:EnumeratedValue Name="板" Value="3"/>
  <opc:EnumeratedValue Name="丸パイプ" Value="4"/>
  <opc:EnumeratedValue Name="角パイプ" Value="5"/>
  <opc:EnumeratedValue Name="丸パイプ材2本束ね" Value="6"/>
  <opc:EnumeratedValue Name="角パイプ材2本束ね" Value="7"/>
  <opc:EnumeratedValue Name="六角" Value="8"/>
  <opc:EnumeratedValue Name="束ね切り" Value="9"/>
 </opc:EnumeratedType>
  <opc:StructuredType BaseType="ua:ExtensionObject" Name="MyStruct">
  <opc:Field TypeName="opc:CharArray" Name="Name"/>
  <opc:Field TypeName="tns:MyEnumeration" Name="Shape"/>
  </opc:StructuredType>
</opc:TypeDictionary>
`;

        const binaryEncodingNodeId = resolveNodeId("ns=1;i=1");

        const idProvider = {
            getDataTypeAndEncodingId(key: string): DataTypeAndEncodingId | null {
                switch (key) {
                    case "MyStruct": {
                        return {
                            binaryEncodingNodeId: binaryEncodingNodeId,
                            dataTypeNodeId: resolveNodeId("ns=1;i=2"),
                            xmlEncodingNodeId: NodeId.nullNodeId,
                            jsonEncodingNodeId: NodeId.nullNodeId
                        };
                    }
                }
                throw new Error("Not implemented");
            }
        };
        const dataTypeFactory = new DataTypeFactory([]);
        await parseBinaryXSD(schema1, idProvider, dataTypeFactory);

        const e = dataTypeFactory.getEnumeration("MyEnumeration");

        const s = dataTypeFactory.constructObject(binaryEncodingNodeId) as any;
        s.shape.should.eql(1);
        doDebug && console.log(s.toString());
        //       console.log(s.toString());
    });
});
