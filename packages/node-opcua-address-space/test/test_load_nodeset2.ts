// tslint:disable:no-bitwise
import * as fs from "fs";
import { AccessLevelFlag, AttributeIds } from "node-opcua-data-model";
import * as nodesets from "node-opcua-nodesets";
import { getFixture } from "node-opcua-test-fixtures";
import { DataType, Variant } from "node-opcua-variant";
import * as path from "path";
import * as should from "should";
import { AddressSpace, generateAddressSpace, UAVariable } from "..";
// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing NodeSet XML file loading", function(this: any) {
    this.timeout(200000); // could be slow on appveyor !

    let addressSpace: AddressSpace;
    beforeEach(() => {
        addressSpace = AddressSpace.create();
        const namespace0 = addressSpace.getDefaultNamespace() as any;
        Object.keys(namespace0._aliases).length.should.equal(0);
        Object.keys(namespace0._variableTypeMap).length.should.equal(0);
        Object.keys(namespace0._referenceTypeMap).length.should.equal(0);
        Object.keys(namespace0._dataTypeMap).length.should.equal(0);
        Object.keys(namespace0._objectTypeMap).length.should.equal(0);
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
        Object.keys(namespace0._aliases).length.should.be.greaterThan(10);
        Object.keys(namespace0._variableTypeMap).length.should.be.greaterThan(3);
        Object.keys(namespace0._referenceTypeMap).length.should.be.greaterThan(10);
        Object.keys(namespace0._dataTypeMap).length.should.be.greaterThan(2);
        Object.keys(namespace0._objectTypeMap).length.should.be.greaterThan(1);

    });

    it("should load a large nodeset xml file", async () => {

        // set a large timeout ( loading the large nodeset xml file could be very slow on RPI)
        this.timeout(Math.max(400000, this._timeout));

        const xml_file = nodesets.standard_nodeset_file;

        fs.existsSync(xml_file).should.be.eql(true);

        await generateAddressSpace(addressSpace, xml_file);

        const namespace0 = addressSpace.getDefaultNamespace() as any;
        namespace0.addressSpace.should.eql(addressSpace);

        Object.keys(namespace0._aliases).length.should.be.greaterThan(10);
        Object.keys(namespace0._variableTypeMap).length.should.be.greaterThan(10);
        Object.keys(namespace0._referenceTypeMap).length.should.be.greaterThan(10);
        Object.keys(namespace0._dataTypeMap).length.should.be.greaterThan(10);
        Object.keys(namespace0._objectTypeMap).length.should.be.greaterThan(10);

    });

    it("should load the DI nodeset ", async () => {

        const xml_files = [
            nodesets.standard_nodeset_file,
            nodesets.di_nodeset_filename
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true, " standard node set file shall exist");
        fs.existsSync(xml_files[1]).should.be.eql(true, " DI node set file shall exist");

        await generateAddressSpace(addressSpace, xml_files);

        const namespace0 = addressSpace.getDefaultNamespace() as any;
        namespace0.namespaceUri.should.eql("http://opcfoundation.org/UA/");
        namespace0.addressSpace.should.eql(addressSpace);

        Object.keys(namespace0._aliases).length.should.be.greaterThan(10);
        Object.keys(namespace0._variableTypeMap).length.should.be.greaterThan(10);
        Object.keys(namespace0._referenceTypeMap).length.should.be.greaterThan(10);
        Object.keys(namespace0._dataTypeMap).length.should.be.greaterThan(10);
        Object.keys(namespace0._objectTypeMap).length.should.be.greaterThan(10);

        const namespace1 = addressSpace.getNamespace(1) as any;
        namespace1.namespaceUri.should.eql("http://opcfoundation.org/UA/DI/");
        namespace1.addressSpace.should.eql(addressSpace);

        Object.keys(namespace1._aliases).length.should.be.eql(0);
        Object.keys(namespace1._variableTypeMap).length.should.be.greaterThan(0);
        Object.keys(namespace1._referenceTypeMap).length.should.be.greaterThan(2);
        Object.keys(namespace1._dataTypeMap).length.should.be.greaterThan(4);
        Object.keys(namespace1._objectTypeMap).length.should.be.greaterThan(9);

    });

    it("should read accessLevel and userAccessLevel attributes", async () => {

        this.timeout(Math.max(400000, this._timeout));

        const xml_file = getFixture("fixture_node_with_various_access_level_nodeset.xml");

        const xml_files = [
            nodesets.standard_nodeset_file,
            xml_file
        ];
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

        this.timeout(Math.max(400000, this._timeout));

        const xml_file = getFixture("fixture_node_with_predefined_variable.xml");

        const xml_files = [
            nodesets.standard_nodeset_file,
            xml_file
        ];

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

        const xml_files = [
            xml_file1, xml_file2
        ];
        await generateAddressSpace(addressSpace, xml_files);

        const ns = addressSpace.getNamespaceIndex("MYNAMESPACE");
        ns.should.eql(1);
        const my3x3MatrixType = addressSpace.findVariableType("My3x3MatrixType", ns)!;
        should.exist(my3x3MatrixType);

        my3x3MatrixType.browseName.toString().should.eql("1:My3x3MatrixType");

        addressSpace.findDataType(my3x3MatrixType.dataType)!.browseName.toString().should.eql("Float");

        my3x3MatrixType.valueRank.should.eql(2);
        my3x3MatrixType.arrayDimensions.should.eql([3, 3]);
        (my3x3MatrixType as any).value.toString().should.eql(new Variant({
            dataType: "Float", value: [11, 12, 13, 21, 22, 23, 31, 32, 33]
        }).toString());

        const myDoubleArrayType = addressSpace.findVariableType("MyDoubleArrayType", ns)!;
        myDoubleArrayType.browseName.toString().should.eql("1:MyDoubleArrayType");
        myDoubleArrayType.valueRank.should.eql(1);
        myDoubleArrayType.arrayDimensions.should.eql([5]);
        (myDoubleArrayType as any).value.toString().should.eql(
          new Variant({ dataType: "Double", value: [1, 2, 3, 4, 5] }).toString());

    });

    it("#339 default ValueRank should be -1  for UAVariable and UAVariableType when loading nodeset2.xml files",
      async () => {

          const xml_files = [
              nodesets.standard_nodeset_file
          ];
          fs.existsSync(xml_files[0]).should.be.eql(true, " standard node set file shall exist");
          await generateAddressSpace(addressSpace, xml_files);
          addressSpace.rootFolder.objects.server.serverStatus.valueRank.should.eql(-1);

      });

    it("VV1 should load a nodeset file with a Models section", async () => {

        const xml_file1 = path.join(__dirname,
          "../test_helpers/test_fixtures/minimalist_nodeset_with_models.xml");
        const xml_files = [
            xml_file1
        ];
        await generateAddressSpace(addressSpace, xml_files);
    });

    it("VV2 should load a nodeset file with hierarchy of Models", async () => {
          const xml_file1 = path.join(__dirname,
            "../test_helpers/test_fixtures/minimalist_nodeset_with_models_more_complex.xml");
          const xml_files = [
              xml_file1
          ];
          await generateAddressSpace(addressSpace, xml_files);
      }
    );

    it("VV3 should load a nodeset from UAModeler", async () => {
          const xml_file1 = path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml");
          const xml_file2 = path.join(__dirname, "../../../modeling/my_data_type.xml");
          const xml_files = [xml_file1, xml_file2];
          await generateAddressSpace(addressSpace, xml_files);

          // now verify that Variable containing Extension Object defined as value in the XML file
          // have been correctly processed

          const ns = addressSpace.getNamespaceIndex("http://yourorganisation.org/my_data_type/");
          // xx console.log("namespace ", ns);

          const variableType1 = addressSpace.findVariableType("MyStructureType", ns)!;
          const value = variableType1.readAttribute(null, AttributeIds.Value);
          // xx console.log(value.toString());
      }
    );

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

        const dataType = addressSpace.findNode("i=95")!;
        console.log(dataType.toString());

    });

});
