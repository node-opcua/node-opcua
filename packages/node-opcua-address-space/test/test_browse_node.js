"use strict";
/*global describe,require,it,before*/

const should = require("should");

const dumpReferences = require("../src/base_node").dumpReferences;
const dumpBrowseDescription = require("../src/base_node").dumpBrowseDescription;
const BrowseDirection = require("node-opcua-data-model").BrowseDirection;
const redirectToFile = require("node-opcua-debug").redirectToFile;

const get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing address space", function () {

    let addressSpace = null;
    before(function (done) {
        get_mini_address_space(function (err, data) {
            addressSpace = data;
            done(err);
        });
    });
    after(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        done();
    });

    it("should dump references", function (done) {

        const hr = addressSpace.findReferenceType("HierarchicalReferences");

        redirectToFile("dumpReferences.log", function () {
            dumpReferences(addressSpace, hr._references);
        }, done);

    });

    it("should dump a browseDescription", function (done) {
        const browseDescription = {
            browseDirection: BrowseDirection.Both,
            referenceTypeId: "HierarchicalReferences",
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        };

        const hr = addressSpace.findReferenceType("HierarchicalReferences");
        redirectToFile("dumpBrowseDescription.log", function () {
            dumpBrowseDescription(hr, browseDescription);
        }, done);

    });

    it("should provide a convenient a way to construct the node full name ", function () {

        const obj = addressSpace.findNode("Server_ServerStatus_BuildInfo");
        obj.full_name().should.eql("Server.ServerStatus.BuildInfo");

    });


});

describe("testing dump browseDescriptions", function () {


    let addressSpace = null;
    before(function (done) {
        get_mini_address_space(function (err, data) {
            addressSpace = data;
            done(err);
        });
    });
    after(function () {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });
    it("should provide a way to find a Method object by nodeId", function () {
        should.exist(addressSpace.findMethod("ns=0;i=11489"));
    });
});
