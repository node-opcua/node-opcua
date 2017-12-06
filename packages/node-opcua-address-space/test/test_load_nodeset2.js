"use strict";

var generate_address_space = require("..").generate_address_space;
var AddressSpace = require("..").AddressSpace;
var DataType = require("node-opcua-variant").DataType;
var should = require("should");
var path = require("path");
var fs = require("fs");
var getFixture = require("node-opcua-test-fixtures").getFixture;
var nodesets = require("node-opcua-nodesets");
var getFixture = require("node-opcua-test-fixtures").getFixture;


var describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing NodeSet XML file loading", function () {


    this.timeout(200000); // could be slow on appveyor !

    var addressSpace;


    beforeEach(function () {

        addressSpace = new AddressSpace();
        Object.keys(addressSpace._aliases).length.should.equal(0);
        Object.keys(addressSpace._variableTypeMap).length.should.equal(0);
        Object.keys(addressSpace._referenceTypeMap).length.should.equal(0);
        Object.keys(addressSpace._dataTypeMap).length.should.equal(0);
        Object.keys(addressSpace._objectTypeMap).length.should.equal(0);
    });
    afterEach(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        done();
    });

    it("should load a nodeset xml file", function (done) {

        var xml_file = path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml");

        fs.existsSync(xml_file).should.be.eql(true);

        generate_address_space(addressSpace, xml_file, function (err) {

            Object.keys(addressSpace._aliases).length.should.be.greaterThan(10);
            Object.keys(addressSpace._variableTypeMap).length.should.be.greaterThan(3);
            Object.keys(addressSpace._referenceTypeMap).length.should.be.greaterThan(10);
            Object.keys(addressSpace._dataTypeMap).length.should.be.greaterThan(2);
            Object.keys(addressSpace._objectTypeMap).length.should.be.greaterThan(1);
            done(err);
        });
    });

    it("should load a large nodeset xml file", function (done) {

        // set a large timeout ( loading the large nodeset xml file could be very slow on RPI)
        this.timeout(Math.max(400000, this._timeout));

        var xml_file = nodesets.standard_nodeset_file;

        fs.existsSync(xml_file).should.be.eql(true);

        generate_address_space(addressSpace, xml_file, function (err) {

            Object.keys(addressSpace._aliases).length.should.be.greaterThan(10);
            Object.keys(addressSpace._variableTypeMap).length.should.be.greaterThan(10);
            Object.keys(addressSpace._referenceTypeMap).length.should.be.greaterThan(10);
            Object.keys(addressSpace._dataTypeMap).length.should.be.greaterThan(10);
            Object.keys(addressSpace._objectTypeMap).length.should.be.greaterThan(10);

            done(err);
        });
    });

    it("should load the DI nodeset ", function (done) {

        var xml_files = [
            nodesets.standard_nodeset_file,
            nodesets.di_nodeset_filename
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true, " standard node set file shall exist");
        fs.existsSync(xml_files[1]).should.be.eql(true, " DI node set file shall exist");

        generate_address_space(addressSpace, xml_files, function (err) {

            Object.keys(addressSpace._aliases).length.should.be.greaterThan(10);
            Object.keys(addressSpace._variableTypeMap).length.should.be.greaterThan(10);
            Object.keys(addressSpace._referenceTypeMap).length.should.be.greaterThan(10);
            Object.keys(addressSpace._dataTypeMap).length.should.be.greaterThan(10);
            Object.keys(addressSpace._objectTypeMap).length.should.be.greaterThan(10);

            done(err);
        });
    });

    it("should read accessLevel and userAccessLevel attributes", function (done) {

        this.timeout(Math.max(400000, this._timeout));

        var xml_file = getFixture("fixture_node_with_various_access_level_nodeset.xml");

        var xml_files = [
            nodesets.standard_nodeset_file,
            xml_file
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);

        generate_address_space(addressSpace, xml_files, function (err) {


            var someVariable = addressSpace.findNode("ns=1;i=2");
            someVariable.browseName.toString().should.eql("1:SomeVariable");
            someVariable.userAccessLevel.toString().should.eql("CurrentRead");


            var readOnlyVar = addressSpace.findNode("ns=1;i=3");
            readOnlyVar.browseName.toString().should.eql("1:SomeReadOnlyVar");
            readOnlyVar.userAccessLevel.toString().should.eql("CurrentRead");


            var readWriteVar = addressSpace.findNode("ns=1;i=4");
            readWriteVar.browseName.toString().should.eql("1:SomeReadWriteVar");
            readWriteVar.userAccessLevel.toString().should.eql("CurrentRead | CurrentWrite");


            done(err);
        });
    });

    it("should read predefined values for variables", function (done) {

        this.timeout(Math.max(400000, this._timeout));

        var xml_file = getFixture("fixture_node_with_predefined_variable.xml");

        var xml_files = [
            nodesets.standard_nodeset_file,
            xml_file
        ];

        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);

        generate_address_space(addressSpace, xml_files, function (err) {

            var someStringVariable = addressSpace.findNode("ns=1;i=2");
            someStringVariable.browseName.toString().should.eql("1:SomeStringVariable");
            someStringVariable.readValue().value.dataType.key.should.be.type('string');
            someStringVariable.readValue().value.value.should.eql("any predefined string value");

            var someBoolVariable = addressSpace.findNode("ns=1;i=3");
            someBoolVariable.browseName.toString().should.eql("1:SomeBoolVariable");
            someBoolVariable.readValue().value.dataType.should.equal(DataType.Boolean);
            someBoolVariable.readValue().value.value.should.eql(true);

            done(err);
        });
    });

    it("Q1 should read a VariableType with a default value", function (done) {

        var Variant = require("node-opcua-variant").Variant;

        var xml_file1 = path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml");
        var xml_file2 = getFixture("fixture_variable_type_with_default_value.xml");

        var xml_files = [
            xml_file1, xml_file2
        ];
        generate_address_space(addressSpace, xml_files, function (err) {

            var ns = addressSpace.getNamespaceIndex("MYNAMESPACE");
            var my3x3MatrixType = addressSpace.findVariableType("My3x3MatrixType", ns);
            my3x3MatrixType.browseName.toString().should.eql("1:My3x3MatrixType");

            addressSpace.findDataType(my3x3MatrixType.dataType).browseName.toString().should.eql("Float");

            my3x3MatrixType.valueRank.should.eql(2);
            my3x3MatrixType.arrayDimensions.should.eql([3, 3]);
            my3x3MatrixType.value.toString().should.eql(new Variant({
                dataType: "Float", value: [11, 12, 13, 21, 22, 23, 31, 32, 33]
            }).toString());

            var myDoubleArrayType = addressSpace.findVariableType("MyDoubleArrayType", ns);
            myDoubleArrayType.browseName.toString().should.eql("1:MyDoubleArrayType");
            myDoubleArrayType.valueRank.should.eql(1);
            myDoubleArrayType.arrayDimensions.should.eql([5]);
            myDoubleArrayType.value.toString().should.eql(
              new Variant({dataType: "Double", value: [1, 2, 3, 4, 5]}).toString());

            done(err);
        });
    });

    it("#339 default ValueRank should be -1  for UAVariable and UAVariableType when loading nodeset2.xml files", function (done) {

        var xml_files = [
            nodesets.standard_nodeset_file
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true, " standard node set file shall exist");

        generate_address_space(addressSpace, xml_files, function (err) {
            addressSpace.rootFolder.objects.server.serverStatus.valueRank.should.eql(-1);
            done(err);
        });

    });
});
