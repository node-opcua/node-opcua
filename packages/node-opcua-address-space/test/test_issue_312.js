"use strict";
const path = require("path");
const fs = require("fs");

const generate_address_space = require("..").generate_address_space;
const AddressSpace = require("..").AddressSpace;

const getFixture = require("node-opcua-test-fixtures").getFixture;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Issue 132", function () {


    this.timeout(20000); // could be slow on appveyor !

    let addressSpace;


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

        const xml_file0 = path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml");
        const xml_file1 = getFixture("fixture_issue_312_nodeset2.xml");

        fs.existsSync(xml_file0).should.be.eql(true);

        fs.existsSync(xml_file1).should.be.eql(true);

        const xml_files = [
            xml_file0,
            xml_file1
        ];

        generate_address_space(addressSpace, xml_files, function (err) {
            done(err);
        });
    });

});
