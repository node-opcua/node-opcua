"use strict";
var path = require("path");
var fs = require("fs");

var generate_address_space = require("..").generate_address_space;
var AddressSpace = require("..").AddressSpace;

var getFixture = require("node-opcua-test-fixtures").getFixture;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Issue 132", function () {


    this.timeout(2000); // could be slow on appveyor !

    var addressSpace;


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

        var xml_file0 = path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml");
        var xml_file1 = getFixture("fixture_issue_312_nodeset2.xml");

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

});
