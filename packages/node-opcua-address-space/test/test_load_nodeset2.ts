// tslint:disable:no-bitwise
import * as fs from "fs";
import * as path from "path";
import * as should from "should";

import { AccessLevelFlag, AttributeIds } from "node-opcua-data-model";
import { NodeId, NodeIdType } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { getFixture } from "node-opcua-test-fixtures";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";

import { EnumDefinition } from "node-opcua-types";
import { AddressSpace, UADataType, UAVariable } from "..";
import { generateAddressSpace } from "../nodeJS";

import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing NodeSet XML file loading", function (this: any) {
    this.timeout(200000); // could be slow on appveyor !

    let addressSpace: AddressSpace;
    beforeEach(() => {
        addressSpace = AddressSpace.create();
        const namespace0 = addressSpace.getDefaultNamespace() as any;
        namespace0._aliasCount().should.equal(0);
        namespace0._variableTypeCount().should.equal(0);
        namespace0._referenceTypeCount().should.equal(0);
        namespace0._dataTypeCount().should.equal(0);
        namespace0._objectTypeCount().should.equal(0);
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    it("should load a nodeset xml file", async () => {
        const xml_file = path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml");

        fs.existsSync(xml_file).should.be.eql(true);

        await generateAddressSpace(addressSpace, xml_file);

        const namespace0 = addressSpace.getDefaultNamespace() as any;
        namespace0.addressSpace.should.eql(addressSpace);
        namespace0._aliasCount().should.be.greaterThan(10);
        namespace0._variableTypeCount().should.be.greaterThan(3);
        namespace0._referenceTypeCount().should.be.greaterThan(10);
        namespace0._dataTypeCount().should.be.greaterThan(2);
        namespace0._objectTypeCount().should.be.greaterThan(1);
    });

    it("should load a large nodeset xml file", async () => {
        // set a large timeout ( loading the large nodeset xml file could be very slow on RPI)
        this.timeout(Math.max(400000, this.timeout()));

        const xml_file = nodesets.standard;

        fs.existsSync(xml_file).should.be.eql(true);

        await generateAddressSpace(addressSpace, xml_file);

        const namespace0 = addressSpace.getDefaultNamespace() as any;
        namespace0.addressSpace.should.eql(addressSpace);

        namespace0._aliasCount().should.be.greaterThan(10);
        namespace0._variableTypeCount().should.be.greaterThan(10);
        namespace0._referenceTypeCount().should.be.greaterThan(10);
        namespace0._dataTypeCount().should.be.greaterThan(10);
        namespace0._objectTypeCount().should.be.greaterThan(10);
    });

    it("should load the DI nodeset ", async () => {
        const xml_files = [nodesets.standard, nodesets.di];
        fs.existsSync(xml_files[0]).should.be.eql(true, " standard node set file shall exist");
        fs.existsSync(xml_files[1]).should.be.eql(true, " DI node set file shall exist");

        await generateAddressSpace(addressSpace, xml_files);

        const namespace0 = addressSpace.getDefaultNamespace() as any;
        namespace0.namespaceUri.should.eql("http://opcfoundation.org/UA/");
        namespace0.addressSpace.should.eql(addressSpace);

        namespace0._aliasCount().should.be.greaterThan(10);
        namespace0._variableTypeCount().should.be.greaterThan(10);
        namespace0._referenceTypeCount().should.be.greaterThan(10);
        namespace0._dataTypeCount().should.be.greaterThan(10);
        namespace0._objectTypeCount().should.be.greaterThan(10);

        const namespace1 = addressSpace.getNamespace(1) as any;
        namespace1.namespaceUri.should.eql("http://opcfoundation.org/UA/DI/");
        namespace1.addressSpace.should.eql(addressSpace);

        namespace1._aliasCount().should.be.eql(0);
        namespace1._variableTypeCount().should.be.greaterThan(0);
        namespace1._referenceTypeCount().should.be.greaterThan(2);
        namespace1._dataTypeCount().should.be.greaterThan(4);
        namespace1._objectTypeCount().should.be.greaterThan(9);
    });

    it("should read accessLevel and userAccessLevel attributes", async () => {
        this.timeout(Math.max(400000, this.timeout()));

        const xml_file = getFixture("fixture_node_with_various_access_level_nodeset.xml");

        const xml_files = [nodesets.standard, xml_file];
        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);

        await generateAddressSpace(addressSpace, xml_files);

        const someVariable = addressSpace.findNode("ns=1;i=2")! as UAVariable;
        someVariable.browseName.toString().should.eql("1:SomeVariable");
        someVariable.userAccessLevel.should.eql(AccessLevelFlag.CurrentRead);

        const readOnlyVar = addressSpace.findNode("ns=1;i=3")! as UAVariable;
        readOnlyVar.browseName.toString().should.eql("1:SomeReadOnlyVar");
        readOnlyVar.userAccessLevel.should.eql(AccessLevelFlag.CurrentRead);

        const readWriteVar = addressSpace.findNode("ns=1;i=4")! as UAVariable;
        readWriteVar.browseName.toString().should.eql("1:SomeReadWriteVar");
        readWriteVar.userAccessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
    });

    it("should read predefined values for variables", async () => {
        this.timeout(Math.max(400000, this.timeout()));

        const xml_file = getFixture("fixture_node_with_predefined_variable.xml");

        const xml_files = [nodesets.standard, xml_file];

        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);

        await generateAddressSpace(addressSpace, xml_files);

        const someStringVariable = addressSpace.findNode("ns=1;i=2")! as UAVariable;
        someStringVariable.browseName.toString().should.eql("1:SomeStringVariable");
        someStringVariable.readValue().value.value.should.eql("any predefined string value");

        const someBoolVariable = addressSpace.findNode("ns=1;i=3")! as UAVariable;
        someBoolVariable.browseName.toString().should.eql("1:SomeBoolVariable");
        someBoolVariable.readValue().value.dataType.should.equal(DataType.Boolean);
        someBoolVariable.readValue().value.value.should.eql(true);

        const someFloatVariable = addressSpace.findNode("ns=1;i=4")! as UAVariable;
        someFloatVariable.browseName.toString().should.eql("1:SomeFloatVariable");
        someFloatVariable.readValue().value.dataType.should.equal(DataType.Float);
        someFloatVariable.readValue().value.value.should.eql(0.0);

        const someDoubleVariable = addressSpace.findNode("ns=1;i=5")! as UAVariable;
        someDoubleVariable.browseName.toString().should.eql("1:SomeDoubleVariable");
        someDoubleVariable.readValue().value.dataType.should.equal(DataType.Double);
        someDoubleVariable.readValue().value.value.should.eql(0.0);
    });

    it("Q1 should read a VariableType with a default value", async () => {
        const xml_file1 = path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml");
        const xml_file2 = getFixture("fixture_variable_type_with_default_value.xml");

        const xml_files = [xml_file1, xml_file2];
        await generateAddressSpace(addressSpace, xml_files);

        const ns = addressSpace.getNamespaceIndex("MYNAMESPACE");
        ns.should.eql(1);
        const my3x3MatrixType = addressSpace.findVariableType("My3x3MatrixType", ns)!;
        should.exist(my3x3MatrixType);

        my3x3MatrixType.browseName.toString().should.eql("1:My3x3MatrixType");

        addressSpace.findDataType(my3x3MatrixType.dataType)!.browseName.toString().should.eql("Float");

        my3x3MatrixType.valueRank.should.eql(2);
        my3x3MatrixType.arrayDimensions!.should.eql([3, 3]);
        (my3x3MatrixType as any).value.toString().should.eql(
            new Variant({
                dataType: "Float",
                value: [11, 12, 13, 21, 22, 23, 31, 32, 33]
            }).toString()
        );

        const myDoubleArrayType = addressSpace.findVariableType("MyDoubleArrayType", ns)!;
        myDoubleArrayType.browseName.toString().should.eql("1:MyDoubleArrayType");
        myDoubleArrayType.valueRank.should.eql(1);
        myDoubleArrayType.arrayDimensions!.should.eql([5]);
        (myDoubleArrayType as any).value
            .toString()
            .should.eql(new Variant({ dataType: "Double", value: [1, 2, 3, 4, 5] }).toString());
    });

    it("#339 default ValueRank should be -1  for UAVariable and UAVariableType when loading nodeset2.xml files", async () => {
        const xml_files = [nodesets.standard];
        fs.existsSync(xml_files[0]).should.be.eql(true, " standard node set file shall exist");
        await generateAddressSpace(addressSpace, xml_files);
        addressSpace.rootFolder.objects.server.serverStatus.valueRank.should.eql(-1);
    });

    it("VV0 should provide appropriate error when nodeset file doesn't exist", async () => {
        const xml_file1 = path.join(__dirname, "../test_helpers/test_fixtures/minimalist_nodeset_with_models.xml");
        const xml_files = [xml_file1, "./missing_xml_file.xml"];

        let _err: Error | undefined;
        try {
            await generateAddressSpace(addressSpace, xml_files);
        } catch (err) {
            _err = err;
        }
        should.exists(_err);
        _err!.message.should.match(/.*NODE-OPCUA-E.*/);
    });
    it("VV1 should load a nodeset file with a Models section", async () => {
        const xml_file1 = path.join(__dirname, "../test_helpers/test_fixtures/minimalist_nodeset_with_models.xml");
        const xml_files = [xml_file1];
        await generateAddressSpace(addressSpace, xml_files);
    });

    it("VV2 should load a nodeset file with hierarchy of Models", async () => {
        const xml_file1 = path.join(__dirname, "../test_helpers/test_fixtures/minimalist_nodeset_with_models_more_complex.xml");
        const xml_files = [xml_file1];
        await generateAddressSpace(addressSpace, xml_files);
    });

    it("VV3 should load a nodeset from UAModeler", async () => {
        const xml_file1 = nodesets.standard; // path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml");
        const xml_file2 = path.join(__dirname, "../../../modeling/my_data_type.xml");
        const xml_files = [xml_file1, xml_file2];
        await generateAddressSpace(addressSpace, xml_files);

        // now verify that Variable containing Extension Object defined as value in the XML file
        // have been correctly processed

        const ns = addressSpace.getNamespaceIndex("http://yourorganisation.org/my_data_type/");

        const variableType1 = addressSpace.findVariableType("MyStructureType", ns)!;
        // xx debugLog(value.toString());
    });

    it("VV4 should parse a dataType made of bit sets", async () => {
        /*
         * <UADataType NodeId="i=95" BrowseName="AccessRestrictionType">
         *   <Definition Name="AccessRestrictionType" IsOptionSet="true">
         *     <Field Name="SigningRequired" Value="0" />
         *     <Field Name="EncryptionRequired" Value="1" />
         *     <Field Name="SessionRequired" Value="2" />
         *   </Definition>
         * </UADataType>
         */
        const xml_file1 = path.join(__dirname, "../test_helpers/test_fixtures/dataType_with_isOptionSet.xml");
        const xml_files = [xml_file1];
        await generateAddressSpace(addressSpace, xml_files);

        const dataType = addressSpace.findNode("i=95")! as UADataType;

        should.exist(dataType);

        // TO DO : What should it be .
        // (dataType as any)._getDefinition(false).should.be.instanceOf(StructureDefinition);
    });

    it("VV5 read datatype ", async () => {
        const xml_file1 = path.join(__dirname, "../test_helpers/test_fixtures/dataType_withEnumeration.xml");
        const xml_files = [nodesets.standard, xml_file1];
        await generateAddressSpace(addressSpace, xml_files);

        const dataType = addressSpace.findDataType("DeviceHealthEnumeration", 1)!;

        dataType.nodeId.toString().should.eql("ns=1;i=6244");

        (dataType as any)._getDefinition(true).should.be.instanceOf(EnumDefinition);

        // must have a EnumString property
        const enumStrings = dataType.getChildByName("EnumStrings")!;
        enumStrings.nodeId.toString().should.eql("ns=1;i=6450");

        const v = enumStrings.readAttribute(null, AttributeIds.Value);
        v.value.arrayType.should.eql(VariantArrayType.Array);
        v.value.value[0].toString().should.eql("locale=null text=NORMAL");
        v.value.value[1].toString().should.eql("locale=null text=FAILURE");
        v.value.value[2].toString().should.eql("locale=null text=CHECK_FUNCTION");
        v.value.value[3].toString().should.eql("locale=null text=OFF_SPEC");
        v.value.value[4].toString().should.eql("locale=null text=MAINTENANCE_REQUIRED");
        // debugLog(v.value.toString());

        const namespace = addressSpace.getNamespace(1)!;
        const xml = namespace.toNodeset2XML();

        // xx debugLog(xml);
        xml.should.eql(
            `<?xml version="1.0"?>
<UANodeSet xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:uax="http://opcfoundation.org/UA/2008/02/Types.xsd" xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd">
    <NamespaceUris>
        <Uri>http://opcfoundation.org/UA/DI/</Uri>
    </NamespaceUris>
    <Models/>
    <Aliases>
        <Alias Alias="HasModellingRule">i=37</Alias>
        <Alias Alias="HasProperty">i=46</Alias>
        <Alias Alias="HasSubtype">i=45</Alias>
        <Alias Alias="HasTypeDefinition">i=40</Alias>
        <Alias Alias="LocalizedText">i=21</Alias>
    </Aliases>
<!--ReferenceTypes-->
<!--DataTypes-->
    <UADataType NodeId="ns=1;i=6244" BrowseName="1:DeviceHealthEnumeration">
        <DisplayName>DeviceHealthEnumeration</DisplayName>
        <References>
            <Reference ReferenceType="HasProperty">ns=1;i=6450</Reference>
            <Reference ReferenceType="HasSubtype" IsForward="false">i=29</Reference>
        </References>
        <Definition Name="DeviceHealthEnumeration">
            <Field Name="NORMAL" Value="0">
                <Description>This device functions normally.</Description>
            </Field>
            <Field Name="FAILURE" Value="1">
                <Description>Malfunction of the device or any of its peripherals.</Description>
            </Field>
            <Field Name="CHECK_FUNCTION" Value="2">
                <Description>Functional checks are currently performed.</Description>
            </Field>
            <Field Name="OFF_SPEC" Value="3">
                <Description>The device is currently working outside of its specified range or that internal diagnoses indicate deviations from measured or set values.</Description>
            </Field>
            <Field Name="MAINTENANCE_REQUIRED" Value="4">
                <Description>This element is working, but a maintenance operation is required.</Description>
            </Field>
        </Definition>
    </UADataType>
    <UAVariable NodeId="ns=1;i=6450" BrowseName="EnumStrings" ValueRank="1" DataType="LocalizedText">
        <DisplayName>EnumStrings</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=68</Reference>
            <Reference ReferenceType="HasModellingRule">i=78</Reference>
        </References>
        <Value>
            <ListOfLocalizedText xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">
                <LocalizedText>
                    <Locale/>
                    <Text>NORMAL</Text>
                </LocalizedText>
                <LocalizedText>
                    <Locale/>
                    <Text>FAILURE</Text>
                </LocalizedText>
                <LocalizedText>
                    <Locale/>
                    <Text>CHECK_FUNCTION</Text>
                </LocalizedText>
                <LocalizedText>
                    <Locale/>
                    <Text>OFF_SPEC</Text>
                </LocalizedText>
                <LocalizedText>
                    <Locale/>
                    <Text>MAINTENANCE_REQUIRED</Text>
                </LocalizedText>
            </ListOfLocalizedText>
        </Value>
    </UAVariable>
<!--ObjectTypes-->
<!--VariableTypes-->
<!--Other Nodes-->
</UANodeSet>`
        );
    });

    it("VV6 Coordinates 3DFrame (which is from namespace 0)", async () => {
        const xml_file1 = path.join(__dirname, "../test_helpers/test_fixtures/dataType_with_structures.xml");
        const xml_files = [xml_file1];
        await generateAddressSpace(addressSpace, xml_files);

        const dataType = addressSpace.findDataType("3DFrame", 0)!;
        dataType.browseName.toString().should.eql("3DFrame");
        dataType.symbolicName.toString().should.eql("ThreeDFrame");

        dataType.binaryEncoding?.nodeId.toString().should.eql("ns=0;i=18823");
        dataType.binaryEncodingDefinition?.should.eql("ThreeDFrame");

        dataType.xmlEncoding?.nodeId.toString().should.eql("ns=0;i=18859");
        dataType.xmlEncodingDefinition?.should.eql("//xs:element[@name='ThreeDFrame']");

        dataType.jsonEncoding?.nodeId.toString().should.eql("ns=0;i=19072");

        // now construct some extension object based on this type....
        const frame = addressSpace.constructExtensionObject(dataType);
        debugLog("frame", frame.toString());
    });
    it("VV7 ----------", async () => {
        const xml_file1 = path.join(__dirname, "../test_helpers/test_fixtures/dataType_with_structures.xml");
        const xml_file2 = path.join(__dirname, "../test_helpers/test_fixtures/dataType_in_separateNamespace.xml");
        const xml_files = [xml_file1, xml_file2];
        await generateAddressSpace(addressSpace, xml_files);
        const dataType = addressSpace.findDataType("3DFrame", 0)!;
        should.exist(dataType, " expected to find 3DFrame DataType in addressSpace");
    });

    it("VV8 ----------", async () => {
        addressSpace.registerNamespace("PRIVATE");

        const xml_file2 = path.join(__dirname, "../test_helpers/test_fixtures/dataType_in_separateNamespace_basic.xml");
        const xml_files = [nodesets.standard, xml_file2];
        await generateAddressSpace(addressSpace, xml_files);

        const nsIndex = addressSpace.getNamespaceIndex("urn:MyNamespace/");
        nsIndex.should.be.greaterThan(0);

        const dataType = addressSpace.findDataType("ANY", nsIndex)!;
        dataType.nodeId.namespace.should.eql(nsIndex);
        should.exist(dataType.subtypeOf);
        dataType.subtypeOf?.toString().should.eql("ns=0;i=3");
        dataType.subtypeOfObj?.nodeId.toString().should.eql("ns=0;i=3");
        dataType.basicDataType.should.eql(DataType.Byte);

        should.throws(() => {
            const object = addressSpace.constructExtensionObject(dataType);
        });

        const a = addressSpace.getOwnNamespace().addVariable({
            browseName: "A",
            dataType,
            value: { dataType: DataType.Byte, value: 43 }
        });
        a.setValueFromSource({ dataType: DataType.Byte, value: 23 });

        const HW_SUBMODULE_DataType = addressSpace.findDataType("HW_SUBMODULE", nsIndex)!;
        HW_SUBMODULE_DataType.nodeId.namespace.should.eql(nsIndex);
        HW_SUBMODULE_DataType.subtypeOf!.toString().should.eql("ns=2;i=3034");
        HW_SUBMODULE_DataType.basicDataType.should.eql(DataType.UInt16);
    });

    it("VV9 ----------", async () => {
        addressSpace.registerNamespace("PRIVATE");

        const xml_file2 = path.join(__dirname, "../test_helpers/test_fixtures/dataType_in_separateNamespace_mix.xml");
        const xml_files = [nodesets.standard, xml_file2];
        await generateAddressSpace(addressSpace, xml_files);

        const nsIndex = addressSpace.getNamespaceIndex("urn:MyNamespace/mix");
        nsIndex.should.be.greaterThan(0);

        const dataType = addressSpace.findDataType("F_SYSINFO", nsIndex)!;
        dataType.nodeId.namespace.should.eql(nsIndex);
        dataType.subtypeOf!.toString().should.eql(`ns=${nsIndex};i=3500`);
        dataType.subtypeOfObj!.nodeId.toString().should.eql(`ns=${nsIndex};i=3500`);
        dataType.basicDataType.should.eql(DataType.ExtensionObject);

        const object = addressSpace.constructExtensionObject(dataType);

        const a = addressSpace.getOwnNamespace().addVariable({
            browseName: "A",
            dataType,
            value: { dataType: DataType.ExtensionObject, value: object }
        });
        a.setValueFromSource({ dataType: DataType.ExtensionObject, value: object });
    });
});

describe("Testing variables loading ", function (this: any) {
    this.timeout(200000); // could be slow on appveyor !

    let addressSpace: AddressSpace;
    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        const namespace0 = addressSpace.getDefaultNamespace() as any;
        namespace0._aliasCount().should.equal(0);
        namespace0._variableTypeCount().should.equal(0);
        namespace0._referenceTypeCount().should.equal(0);
        namespace0._dataTypeCount().should.equal(0);
        namespace0._objectTypeCount().should.equal(0);

        const xml_file1 = path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml");

        const xml_file = path.join(__dirname, "../test_helpers/test_fixtures/mini.nodeset.withVariousVariables.xml");
        fs.existsSync(xml_file).should.be.eql(true);

        await generateAddressSpace(addressSpace, [xml_file1, xml_file]);

        namespace0.addressSpace.should.eql(addressSpace);
        namespace0._aliasCount().should.be.greaterThan(10);
        namespace0._variableTypeCount().should.be.greaterThan(3);
        namespace0._referenceTypeCount().should.be.greaterThan(10);
        namespace0._dataTypeCount().should.be.greaterThan(2);
        namespace0._objectTypeCount().should.be.greaterThan(1);
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    it("GG1 - should have a variable with pre-fetched values", () => {
        const ns = addressSpace.getNamespaceIndex("mydemo/");

        let variable = addressSpace.rootFolder.objects.getFolderElementByName("VariableTwoStateDiscrete", ns)! as UAVariable;
        variable = variable || ((addressSpace.rootFolder.objects as any).variableTwoStateDiscrete as UAVariable);

        should.exists(variable);

        const trueState = variable.getChildByName("TrueState")! as UAVariable;
        should.exists(trueState);

        const falseState = variable.getChildByName("FalseState")! as UAVariable;
        should.exists(falseState);

        trueState.readValue().value.toString().should.eql("Variant(Scalar<LocalizedText>, value: locale=null text=PoweredOn)");
        falseState.readValue().value.toString().should.eql("Variant(Scalar<LocalizedText>, value: locale=null text=PoweredOff)");

        variable
            .readValue()
            .value.toString()
            .should.eql(new Variant({ dataType: "Boolean", value: false }).toString());
    });

    it("should load ListOfString variables as an array of strings", () => {
        const ns = addressSpace.getNamespaceIndex("mydemo/");

        const variable = addressSpace.findNode(new NodeId(NodeIdType.STRING, "ListOfString", ns)) as UAVariable;

        should.exists(variable);

        const variant = variable.readValue().value;
        const value = variant.value as string[];
        should.exists(value);

        value.should.instanceOf(Array);
        value.length.should.greaterThan(0);
        value.forEach((arrayElement) => {
            arrayElement.should.instanceOf(String);
        });
    });
});

describe("@A@ Testing loading nodeset with custom basic types", function (this: any) {
    this.timeout(200000); // could be slow on appveyor !

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        const xml_file = path.join(__dirname, "../../../modeling/model_with_custom_datatype.xml");
        fs.existsSync(xml_file).should.be.eql(true, " should find " + xml_file);

        await generateAddressSpace(addressSpace, [nodesets.standard, xml_file]);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should compose new  basic type ", () => {
        const ns = addressSpace.getNamespaceIndex("http://yourorganisation.org/model_with_custom_datatype/");

        const myIdentifierDataType = addressSpace.findDataType("MyIdentifierString", ns)!;
        should.exists(myIdentifierDataType);

        const myStructDataTypeNode = addressSpace.findDataType("MyStruct", ns)!;
        should.exists(myStructDataTypeNode);

        const struct = addressSpace.constructExtensionObject(myStructDataTypeNode, {
            id: "Hello"
        });
        // tslint:disable-next-line: no-console
        debugLog(struct.toString());
    });
});
