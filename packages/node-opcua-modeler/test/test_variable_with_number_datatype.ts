import "should";
import fs from "fs";
import path from "path";
import { tmpdir } from 'node:os';
import { DataTypeIds } from "node-opcua-constants";
import { DataType, Variant } from "node-opcua-variant";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, dumpToBSD, ensureDatatypeExtracted, INamespace, Namespace, UAObject, UAVariable } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/distNodeJS";
import { StructureFieldOptions } from "node-opcua-types";
import { addExtensionObjectDataType } from "..";
import { describeWithLeakDetector as describe} from "node-opcua-leak-detector";

describe("A- testing UAVariable with number dataType", () => {

    let addressSpace: AddressSpace;
    let namespace: INamespace;
    before(async () => {

        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [
            nodesets.standard,
        ]);
        namespace = addressSpace.registerNamespace("Private");
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should create a variable with dataType Number and accept a float in addVariable", async () => {

        const myVariable = namespace.addVariable({
            browseName: "MyVariable",
            dataType: resolveNodeId(DataTypeIds.Number),
            value:  new Variant({ dataType: DataType.Float, value: 3.14 })
          
        });
        
        console.log(myVariable.toString());

        const dataValue = myVariable.readValue();
        dataValue.value.dataType.should.eql(DataType.Float);
        dataValue.value.value.should.eql(3.14);

    });
    it("should create a variable with dataType Number and set it to a float", async () => {

        const myVariable = namespace.addVariable({
            browseName: "MyVariable",
            dataType: resolveNodeId(DataTypeIds.Number),

        });
        myVariable.setValueFromSource({ dataType: DataType.Float, value: 3.14  });

        const dataValue = myVariable.readValue();
        dataValue.value.dataType.should.eql(DataType.Float);
        dataValue.value.value.should.eql(3.14);

    });
    it("should create a variable with dataType Number and  set it to a float then to UInt32", async () => {

        const myVariable = namespace.addVariable({
            browseName: "MyVariable",
            dataType: resolveNodeId(DataTypeIds.Number),

        });
        myVariable.setValueFromSource({ dataType: DataType.Float, value: 3.14 });
        myVariable.setValueFromSource({ dataType: DataType.UInt32, value: 314 });

        const dataValue = myVariable.readValue();
        dataValue.value.dataType.should.eql(DataType.UInt32);
        dataValue.value.value.should.eql(314);
    });
    it("should instantiate a variable with dataType Number and  set it to a float then to UInt32", async () => {

        const objectType = namespace.addObjectType({
            browseName: "MyObjectType"
        }); 
        const myVariable = namespace.addVariable({
            browseName: "MyVariable",
            dataType: resolveNodeId(DataTypeIds.Number),
            modellingRule: "Mandatory",
            propertyOf: objectType
        });

        const obj = objectType.instantiate({
            browseName: "Instance",
            organizedBy: addressSpace.rootFolder.objects
        }); 

        var v = obj.getPropertyByName("MyVariable")! as UAVariable;
        v.setValueFromSource({ dataType: DataType.Float, value: 3.14 });
    });



});

async function createModel() {
    const addressSpace = AddressSpace.create();
    const namespace = addressSpace.registerNamespace("Private");
    await generateAddressSpace(addressSpace, [nodesets.standard]);
    const objectType = namespace.addObject({
        browseName: "MyObject",
        nodeId: "s=MyObject",
        organizedBy: addressSpace.rootFolder.objects    
    });
    const variable = namespace.addVariable({
        browseName: "MyVariable",
        dataType: resolveNodeId(DataTypeIds.Number),
        propertyOf: objectType
    });
    variable.setValueFromSource({ dataType: DataType.Float, value: 3.14 });
    const xml = namespace.toNodeset2XML();
    console.log(xml);
    const nodesetFilename = path.join(tmpdir(),"tmp1.xml");
    fs.writeFileSync(nodesetFilename, xml);
    addressSpace.dispose();
    return nodesetFilename;
}
describe("B- testing UAVariable with number dataType", () => {

    it("should create a model with a variable with dataType Number and  set it to a float then to UInt32", async () => {

        const nodeset = await createModel();
        const addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard, nodeset ]);   
        const obj = addressSpace.rootFolder.objects.getFolderElementByName("MyObject")! as UAObject;   
        const v = obj.getPropertyByName("MyVariable")! as UAVariable;
        v.setValueFromSource({ dataType: DataType.Float, value: 3.14 });

        addressSpace.dispose();
    });

});


async function createModelWithAVariableThatHaveAnExtensionObjectWithAFieldWithDataTypeNumber() {

    const addressSpace = AddressSpace.create();
    const namespace = addressSpace.registerNamespace("Private");
    await generateAddressSpace(addressSpace, [nodesets.standard]);

    const partialDefinition: StructureFieldOptions[] = [
        {
            name: "Field1",
            dataType: resolveNodeId(DataTypeIds.Number),
            valueRank: -1,
            description: "value",
            arrayDimensions: null,
            isOptional: false,
            maxStringLength: 0,
         
        }
    ];

    const uaDataType = await addExtensionObjectDataType(namespace, {
        browseName: "MyDataType",
        description: "DataType with a single field",
        isAbstract: false,
        structureDefinition: {
            baseDataType: resolveNodeId(DataTypeIds.Structure),
            defaultEncodingId: null,
            fields: partialDefinition
        }
    });

    const objectType = namespace.addObject({
        browseName: "MyObject",
        nodeId: "s=MyObject",
        organizedBy: addressSpace.rootFolder.objects
    });
    const variable = namespace.addVariable({
        browseName: "MyVariable",
        dataType: uaDataType,
        propertyOf: objectType
    });
    const variable1 = namespace.addVariable({
        browseName: "MyVariable1",
        dataType: resolveNodeId(DataTypeIds.Number),
        propertyOf: objectType
    });
    variable1.setValueFromSource({ dataType: DataType.Float, value: 3.14 });

    await ensureDatatypeExtracted(addressSpace);
    const xmlbsd = dumpToBSD(namespace);

    const extensionObject = addressSpace.constructExtensionObject(uaDataType, {
        field1: new Variant({ dataType: DataType.Float, value: 3.14 })  
    });
    variable.setValueFromSource({ dataType: DataType.ExtensionObject, value: extensionObject });

    const xml = namespace.toNodeset2XML();
    // console.log(xml);

    const nodesetFilename = path.join(tmpdir(), "tmp2.xml");
    fs.writeFileSync(nodesetFilename, xml);
    addressSpace.dispose();
    return nodesetFilename;
}



describe("C- testing UAVariable with an extension object with a field as number dataType", () => {

    it("should create a model with a variable with an extension object with a dataType Number and  set it to a float then to UInt32", async () => {

        const nodeset = await createModelWithAVariableThatHaveAnExtensionObjectWithAFieldWithDataTypeNumber();
        const addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard, nodeset]);
        const obj = addressSpace.rootFolder.objects.getFolderElementByName("MyObject")! as UAObject;
        const v = obj.getPropertyByName("MyVariable")! as UAVariable;


        const currentValue = v.readValue().value.value; 

        const newValue = addressSpace.constructExtensionObject(v.dataType, {
            field1: new Variant({ dataType: DataType.UInt32, value: 42 })   
        });
        // currentValue.should.be.instanceOf(Object);
        // currentValue.field1 = new Variant({ dataType: DataType.UInt32, value: 42 });
        v.setValueFromSource({ dataType: DataType.ExtensionObject, value: newValue });

        addressSpace.dispose();
    });

});
/*
<opc:TypeDictionary xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:tns="http://yourorganisation.org/toto/" DefaultByteOrder="LittleEndian" xmlns:opc="http://opcfoundation.org/BinarySchema/" xmlns:ua="http://opcfoundation.org/UA/" TargetNamespace="http://yourorganisation.org/toto/">
 <opc:Import Namespace="http://opcfoundation.org/UA/"/>
 <opc:StructuredType BaseType="ua:ExtensionObject" Name="MyStruct">
  <opc:Field TypeName="ua:Variant" Name="Field1"/>
  <opc:Field TypeName="ua:PublishedDataSetCustomSourceDataType" Name="Field2"/>
  <opc:Field TypeName="ua:ExtensionObject" Name="Field3"/>
  <opc:Field TypeName="opc:
  Int32" Name="NoOfField4"/>
  <opc:Field LengthField="NoOfField4" TypeName="ua:Variant" Name="Field4"/>
 </opc:StructuredType>
</opc:TypeDictionary>
*/
/*
<xs:schema elementFormDefault="qualified" targetNamespace="http://yourorganisation.org/toto/Types.xsd" xmlns:tns="http://yourorganisation.org/toto/Types.xsd" xmlns:ua="http://opcfoundation.org/UA/2008/02/Types.xsd" xmlns:xs="http://www.w3.org/2001/XMLSchema">
 <xs:import namespace="http://opcfoundation.org/UA/2008/02/Types.xsd"/>
 <xs:complexType name="MyStruct">
  <xs:sequence>
   <xs:element minOccurs="0" maxOccurs="1" type="ua:Variant" name="Field1"/>
   <xs:element minOccurs="0" maxOccurs="1" type="ua:PublishedDataSetCustomSourceDataType" name="Field2"/>
   <xs:element minOccurs="0" maxOccurs="1" type="ua:ExtensionObject" name="Field3"/>
   <xs:element minOccurs="0" maxOccurs="1" type="ua:ListOfVariant" name="Field4"/>
  </xs:sequence>
 </xs:complexType>
 <xs:element type="tns:MyStruct" name="MyStruct"/>
 <xs:complexType name="ListOfMyStruct">
  <xs:sequence>
   <xs:element minOccurs="0" maxOccurs="unbounded" type="tns:MyStruct" name="MyStruct" nillable="true"/>
  </xs:sequence>
 </xs:complexType>
 <xs:element type="tns:ListOfMyStruct" name="ListOfMyStruct" nillable="true"/>
</xs:schema>
*/
/*
<Definition Name="1:MyStruct">
    <Field AllowSubTypes="true" DataType="Number" Name="Field1"/>
    <Field DataType="PublishedDataSetCustomSourceDataType" Name="Field2"/>
    <Field AllowSubTypes="true" DataType="PublishedDataSetCustomSourceDataType" Name="Field3"/>
    <Field AllowSubTypes="true" DataType="Integer" ValueRank="1" ArrayDimensions="0" Name="Field4"/>
</Definition>

<Value>
            <ExtensionObject xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">
                <TypeId>
                    <Identifier>ns=1;i=1002</Identifier>
                </TypeId>
                <Body>
                    <MyDataType>
                        <Field1>
                            <Value>
                                <Float>3.14</Float>
                            </Value>
                        </Field1>
                    </MyDataType>
*/