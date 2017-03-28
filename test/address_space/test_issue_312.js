"use strict";
require("requirish")._(module);
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var DataType = require("lib/datamodel/variant").DataType;
var should = require("should");
var path = require("path");
var fs = require("fs");

describe("Issue 132", function () {


    this.timeout(2000); // could be slow on appveyor !

    var addressSpace;

    //xx require("test/helpers/resource_leak_detector").installResourceLeakDetector(true,function() {

        beforeEach(function (done) {
            addressSpace = new AddressSpace();
            done();
        });
        afterEach(function (done) {
            if (addressSpace) {
                addressSpace.dispose();
            }
            done();
        });

        it("#312 - should load a nodeset xml file containing MandatoryPlaceHolder f", function (done) {

            //var xml_file0 = path.join(__dirname,"../../nodesets/Opc.Ua.NodeSet2.xml");
            var xml_file0 = path.join(__dirname,"../../lib/server/mini.Node.Set2.xml");
            var xml_file1 = path.join(__dirname,"../fixtures/fixture_issue_312_nodeset2.xml");

            fs.existsSync(xml_file0).should.be.eql(true);

            fs.existsSync(xml_file1).should.be.eql(true);

            var xml_files = [
                xml_file0,
                xml_file1
            ];

            generate_address_space(addressSpace, xml_files, function (err) {
                done(err);
            });
        });

    //xx });
});
