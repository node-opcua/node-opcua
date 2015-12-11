"use strict";
require("requirish")._(module);
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var should = require("should");
var path = require("path");

describe("testing NodeSet XML file loading", function () {


    var addressSpace;

    require("test/helpers/resource_leak_detector").installResourceLeakDetector(true,function() {

        beforeEach(function () {

            addressSpace = new AddressSpace();
            Object.keys(addressSpace._aliases).length.should.equal(0);
            Object.keys(addressSpace._objectMap).length.should.equal(0);
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
    });

    it("should load a nodeset xml file", function (done) {

        var xml_file = path.join(__dirname,"../../lib/server/mini.Node.Set2.xml");

        require("fs").existsSync(xml_file).should.be.eql(true);

        generate_address_space(addressSpace, xml_file, function (err) {

            Object.keys(addressSpace._aliases).length.should.be.greaterThan(10);
            Object.keys(addressSpace._objectMap).length.should.be.greaterThan(10);
            Object.keys(addressSpace._variableTypeMap).length.should.be.greaterThan(3);
            Object.keys(addressSpace._referenceTypeMap).length.should.be.greaterThan(10);
            Object.keys(addressSpace._dataTypeMap).length.should.be.greaterThan(2);
            Object.keys(addressSpace._objectTypeMap).length.should.be.greaterThan(1);
            done(err);
        });
    });

    it("should load a large nodeset xml file", function (done) {

        // set a large timeout ( loading the large nodeset xml file could be very slow on RPI)
        this.timeout(Math.max(400000,this._timeout));

        var xml_file = path.join(__dirname,"../../nodesets/Opc.Ua.NodeSet2.xml");
        require("fs").existsSync(xml_file).should.be.eql(true);

        generate_address_space(addressSpace, xml_file, function (err) {

            Object.keys(addressSpace._aliases).length.should.be.greaterThan(10);
            Object.keys(addressSpace._objectMap).length.should.be.greaterThan(10);
            Object.keys(addressSpace._variableTypeMap).length.should.be.greaterThan(10);
            Object.keys(addressSpace._referenceTypeMap).length.should.be.greaterThan(10);
            Object.keys(addressSpace._dataTypeMap).length.should.be.greaterThan(10);
            Object.keys(addressSpace._objectTypeMap).length.should.be.greaterThan(10);

            done(err);
        });
    });

    it("should load the DI nodeset ", function (done) {

        var xml_files = [
            path.join(__dirname ,"../../nodesets/Opc.Ua.NodeSet2.xml"),
            path.join(__dirname, "../../nodesets/Opc.Ua.Di.NodeSet2.xml")
        ];
        require("fs").existsSync(xml_files[0]).should.be.eql(true, " standard node set file shall exist");
        require("fs").existsSync(xml_files[1]).should.be.eql(true, " DI node set file shall exist");

        generate_address_space(addressSpace, xml_files, function (err) {

            Object.keys(addressSpace._aliases).length.should.be.greaterThan(10);
            Object.keys(addressSpace._objectMap).length.should.be.greaterThan(10);
            Object.keys(addressSpace._variableTypeMap).length.should.be.greaterThan(10);
            Object.keys(addressSpace._referenceTypeMap).length.should.be.greaterThan(10);
            Object.keys(addressSpace._dataTypeMap).length.should.be.greaterThan(10);
            Object.keys(addressSpace._objectTypeMap).length.should.be.greaterThan(10);

            done(err);
        });
    });

    it("should read accessLevel and userAccessLevel attributes", function(done) {

        this.timeout(Math.max(400000,this._timeout));

        var xml_file = path.join(__dirname,"../fixtures/fixture_node_with_various_access_level_nodeset.xml");

        var xml_files = [
            path.join(__dirname ,"../../nodesets/Opc.Ua.NodeSet2.xml"),
            xml_file
        ];
        require("fs").existsSync(xml_files[0]).should.be.eql(true);
        require("fs").existsSync(xml_files[1]).should.be.eql(true);

        generate_address_space(addressSpace, xml_files, function (err) {


            var someVariable = addressSpace.findObject("ns=1;i=2");
            someVariable.browseName.toString().should.eql("1:SomeVariable");
            someVariable.userAccessLevel.toString().should.eql("CurrentRead");


            var readOnlyVar = addressSpace.findObject("ns=1;i=3");
            readOnlyVar.browseName.toString().should.eql("1:SomeReadOnlyVar");
            readOnlyVar.userAccessLevel.toString().should.eql("CurrentRead");



            var readWriteVar = addressSpace.findObject("ns=1;i=4");
            readWriteVar.browseName.toString().should.eql("1:SomeReadWriteVar");
            readWriteVar.userAccessLevel.toString().should.eql("CurrentRead | CurrentWrite");


            done(err);
        });
    });
});
