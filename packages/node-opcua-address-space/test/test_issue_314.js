"use strict";
var should = require("should");

var generate_address_space = require("..").generate_address_space;
var AddressSpace = require("..").AddressSpace;
var DataType = require("node-opcua-variant").DataType;
var path = require("path");
var fs = require("fs");
var nodesets = require("node-opcua-nodesets");

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing loading ExtensonObject value from NodeSet XML file", function () {

    this.timeout(20000); // could be slow on appveyor !

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

    it("#314 should load a EUInformation value from nodeset xml file", function (done) {

        var xml_file = path.join(__dirname, "../test_helpers/test_fixtures/nodeset_with_analog_items.xml");
        fs.existsSync(xml_file).should.be.eql(true);

        var xml_files = [
            nodesets.standard_nodeset_file,
            nodesets.di_nodeset_filename,
            xml_file
        ];
        generate_address_space(addressSpace, xml_files, function (err) {

            Object.keys(addressSpace._aliases).length.should.be.greaterThan(10);
            Object.keys(addressSpace._variableTypeMap).length.should.be.greaterThan(3);
            Object.keys(addressSpace._referenceTypeMap).length.should.be.greaterThan(10);
            Object.keys(addressSpace._dataTypeMap).length.should.be.greaterThan(2);
            Object.keys(addressSpace._objectTypeMap).length.should.be.greaterThan(1);

            var nodeId = "ns=2;i=6038";
            var node = addressSpace.findNode(nodeId);
            node.browseName.toString().should.eql("EngineeringUnits");

            node.readValue().value.dataType.should.eql(DataType.ExtensionObject);
            node.readValue().value.value.constructor.name.should.eql("EUInformation");
            node.readValue().value.value.namespaceUri.should.eql("http://www.opcfoundation.org/UA/units/un/cefact");
            node.readValue().value.value.unitId.should.eql(5066068);
            node.readValue().value.value.displayName.toString().should.eql("locale=null text=mm");
            node.readValue().value.value.description.toString().should.eql("locale=meter text=millimetre");

            done(err);
        });
    });
});
