"use strict";
/*global describe,require,it,before*/

var should = require("should");

var dumpReferences = require("../src/base_node").dumpReferences;
var dumpBrowseDescription = require("../src/base_node").dumpBrowseDescription;
var BrowseDirection = require("node-opcua-data-model").BrowseDirection;
var redirectToFile = require("node-opcua-debug").redirectToFile;

var get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing address space", function () {

    var addressSpace = null;
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

        var hr = addressSpace.findReferenceType("HierarchicalReferences");

        redirectToFile("dumpReferences.log", function () {
            dumpReferences(addressSpace, hr._references);
        }, done);

    });

    it("should dump a browseDescription", function (done) {
        var browseDescription = {
            browseDirection: BrowseDirection.Both,
            referenceTypeId: "HierarchicalReferences",
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        };

        var hr = addressSpace.findReferenceType("HierarchicalReferences");
        redirectToFile("dumpBrowseDescription.log", function () {
            dumpBrowseDescription(hr, browseDescription);
        }, done);

    });

    it("should provide a convenient a way to construct the node full name ", function () {

        var obj = addressSpace.findNode("Server_ServerStatus_BuildInfo");
        obj.full_name().should.eql("Server.ServerStatus.BuildInfo");

    });


});

describe("testing dump browseDescriptions", function () {


    var addressSpace = null;
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
