"use strict";

const generate_address_space = require("..").generate_address_space;
const AddressSpace = require("..").AddressSpace;
const DataType = require("node-opcua-variant").DataType;
const should = require("should");
const path = require("path");
const fs = require("fs");
const nodesets = require("node-opcua-nodesets");
const getFixture = require("node-opcua-test-fixtures").getFixture;


const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing NodeSet XML file loading", function () {


    this.timeout(200000); // could be slow on appveyor !

    let addressSpace;


    beforeEach(function () {

        addressSpace = new AddressSpace();
        const namespace0 = addressSpace.getDefaultNamespace();

        Object.keys(namespace0._aliases).length.should.equal(0);
        Object.keys(namespace0._variableTypeMap).length.should.equal(0);
        Object.keys(namespace0._referenceTypeMap).length.should.equal(0);
        Object.keys(namespace0._dataTypeMap).length.should.equal(0);
        Object.keys(namespace0._objectTypeMap).length.should.equal(0);
    });
    afterEach(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        done();
    });

    it("should load a nodeset xml file", function (done) {

        const xml_file = path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml");

        fs.existsSync(xml_file).should.be.eql(true);

        generate_address_space(addressSpace, xml_file, function (err) {

            const namespace0 = addressSpace.getDefaultNamespace();

            namespace0.addressSpace.should.eql(addressSpace);

            Object.keys(namespace0._aliases).length.should.be.greaterThan(10);
            Object.keys(namespace0._variableTypeMap).length.should.be.greaterThan(3);
            Object.keys(namespace0._referenceTypeMap).length.should.be.greaterThan(10);
            Object.keys(namespace0._dataTypeMap).length.should.be.greaterThan(2);
            Object.keys(namespace0._objectTypeMap).length.should.be.greaterThan(1);
            done(err);
        });
    });

    it("should load a large nodeset xml file", function (done) {

        // set a large timeout ( loading the large nodeset xml file could be very slow on RPI)
        this.timeout(Math.max(400000, this._timeout));

        const xml_file = nodesets.standard_nodeset_file;

        fs.existsSync(xml_file).should.be.eql(true);

        generate_address_space(addressSpace, xml_file, function (err) {

            const namespace0 = addressSpace.getDefaultNamespace();
            namespace0.addressSpace.should.eql(addressSpace);

            Object.keys(namespace0._aliases).length.should.be.greaterThan(10);
            Object.keys(namespace0._variableTypeMap).length.should.be.greaterThan(10);
            Object.keys(namespace0._referenceTypeMap).length.should.be.greaterThan(10);
            Object.keys(namespace0._dataTypeMap).length.should.be.greaterThan(10);
            Object.keys(namespace0._objectTypeMap).length.should.be.greaterThan(10);

            done(err);
        });
    });

    it("should load the DI nodeset ", function (done) {

        const xml_files = [
            nodesets.standard_nodeset_file,
            nodesets.di_nodeset_filename
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true, " standard node set file shall exist");
        fs.existsSync(xml_files[1]).should.be.eql(true, " DI node set file shall exist");

        generate_address_space(addressSpace, xml_files, function (err) {

            const namespace0 = addressSpace.getDefaultNamespace();
            namespace0.namespaceUri.should.eql("http://opcfoundation.org/UA/");
            namespace0.addressSpace.should.eql(addressSpace);

            Object.keys(namespace0._aliases).length.should.be.greaterThan(10);
            Object.keys(namespace0._variableTypeMap).length.should.be.greaterThan(10);
            Object.keys(namespace0._referenceTypeMap).length.should.be.greaterThan(10);
            Object.keys(namespace0._dataTypeMap).length.should.be.greaterThan(10);
            Object.keys(namespace0._objectTypeMap).length.should.be.greaterThan(10);

            const namespace1 = addressSpace.getNamespace(1);
            namespace1.namespaceUri.should.eql("http://opcfoundation.org/UA/DI/");
            namespace1.addressSpace.should.eql(addressSpace);

            Object.keys(namespace1._aliases).length.should.be.eql(0);
            Object.keys(namespace1._variableTypeMap).length.should.be.greaterThan(0);
            Object.keys(namespace1._referenceTypeMap).length.should.be.greaterThan(2);
            Object.keys(namespace1._dataTypeMap).length.should.be.greaterThan(4);
            Object.keys(namespace1._objectTypeMap).length.should.be.greaterThan(9   );

            done(err);
        });
    });

    it("should read accessLevel and userAccessLevel attributes", function (done) {

        this.timeout(Math.max(400000, this._timeout));

        const xml_file = getFixture("fixture_node_with_various_access_level_nodeset.xml");

        const xml_files = [
            nodesets.standard_nodeset_file,
            xml_file
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);

        generate_address_space(addressSpace, xml_files, function (err) {


            const someVariable = addressSpace.findNode("ns=1;i=2");
            someVariable.browseName.toString().should.eql("1:SomeVariable");
            someVariable.userAccessLevel.toString().should.eql("CurrentRead");


            const readOnlyVar = addressSpace.findNode("ns=1;i=3");
            readOnlyVar.browseName.toString().should.eql("1:SomeReadOnlyVar");
            readOnlyVar.userAccessLevel.toString().should.eql("CurrentRead");


            const readWriteVar = addressSpace.findNode("ns=1;i=4");
            readWriteVar.browseName.toString().should.eql("1:SomeReadWriteVar");
            readWriteVar.userAccessLevel.toString().should.eql("CurrentRead | CurrentWrite");


            done(err);
        });
    });

    it("should read predefined values for variables", function (done) {

        this.timeout(Math.max(400000, this._timeout));

        const xml_file = getFixture("fixture_node_with_predefined_variable.xml");

        const xml_files = [
            nodesets.standard_nodeset_file,
            xml_file
        ];

        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);

        generate_address_space(addressSpace, xml_files, function (err) {

            const someStringVariable = addressSpace.findNode("ns=1;i=2");
            someStringVariable.browseName.toString().should.eql("1:SomeStringVariable");
            someStringVariable.readValue().value.dataType.key.should.be.type('string');
            someStringVariable.readValue().value.value.should.eql("any predefined string value");

            const someBoolVariable = addressSpace.findNode("ns=1;i=3");
            someBoolVariable.browseName.toString().should.eql("1:SomeBoolVariable");
            someBoolVariable.readValue().value.dataType.should.equal(DataType.Boolean);
            someBoolVariable.readValue().value.value.should.eql(true);

            const someFloatVariable = addressSpace.findNode("ns=1;i=4");
            someFloatVariable.browseName.toString().should.eql("1:SomeFloatVariable");
            someFloatVariable.readValue().value.dataType.should.equal(DataType.Float);
            someFloatVariable.readValue().value.value.should.eql(0.0);

            const someDoubleVariable = addressSpace.findNode("ns=1;i=5");
            someDoubleVariable.browseName.toString().should.eql("1:SomeDoubleVariable");
            someDoubleVariable.readValue().value.dataType.should.equal(DataType.Double);
            someDoubleVariable.readValue().value.value.should.eql(0.0);

            done(err);
        });
    });

    it("Q1 should read a VariableType with a default value", function (done) {

        const Variant = require("node-opcua-variant").Variant;

        const xml_file1 = path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml");
        const xml_file2 = getFixture("fixture_variable_type_with_default_value.xml");

        const xml_files = [
            xml_file1, xml_file2
        ];
        generate_address_space(addressSpace, xml_files, function (err) {

            const ns = addressSpace.getNamespaceIndex("MYNAMESPACE");
            ns.should.eql(1);
            const my3x3MatrixType = addressSpace.findVariableType("My3x3MatrixType", ns);
            should.exist(my3x3MatrixType);

            my3x3MatrixType.browseName.toString().should.eql("1:My3x3MatrixType");

            addressSpace.findDataType(my3x3MatrixType.dataType).browseName.toString().should.eql("Float");

            my3x3MatrixType.valueRank.should.eql(2);
            my3x3MatrixType.arrayDimensions.should.eql([3, 3]);
            my3x3MatrixType.value.toString().should.eql(new Variant({
                dataType: "Float", value: [11, 12, 13, 21, 22, 23, 31, 32, 33]
            }).toString());

            const myDoubleArrayType = addressSpace.findVariableType("MyDoubleArrayType", ns);
            myDoubleArrayType.browseName.toString().should.eql("1:MyDoubleArrayType");
            myDoubleArrayType.valueRank.should.eql(1);
            myDoubleArrayType.arrayDimensions.should.eql([5]);
            myDoubleArrayType.value.toString().should.eql(
              new Variant({dataType: "Double", value: [1, 2, 3, 4, 5]}).toString());

            done(err);
        });
    });

    it("#339 default ValueRank should be -1  for UAVariable and UAVariableType when loading nodeset2.xml files", function (done) {

        const xml_files = [
            nodesets.standard_nodeset_file
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true, " standard node set file shall exist");

        generate_address_space(addressSpace, xml_files, function (err) {
            addressSpace.rootFolder.objects.server.serverStatus.valueRank.should.eql(-1);
            done(err);
        });

    });

    it("VV1 should load a nodeset file with a Models section",function(done){


        const xml_file1 = path.join(__dirname, "../test_helpers/test_fixtures/minimalist_nodeset_with_models.xml");

        const xml_files = [
            xml_file1
        ];
         generate_address_space(addressSpace, xml_files, function (err) {
            done();
        });

    });
    it("VV2 should load a nodeset file with hierarchy of Models",function(done){


        const xml_file1 = path.join(__dirname, "../test_helpers/test_fixtures/minimalist_nodeset_with_models_more_complex.xml");

        const xml_files = [
            xml_file1
        ];
        generate_address_space(addressSpace, xml_files, function (err) {
            done();
        });

    });
    it("VV3 should load a nodeset from UAModeler",function(done){


        const xml_file1 = path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml");
        const xml_file2= path.join(__dirname, "../../../modeling/my_data_type.xml");

        const xml_files = [ xml_file1, xml_file2];

        generate_address_space(addressSpace, xml_files, function (err) {
            done();
        });

    });
});
