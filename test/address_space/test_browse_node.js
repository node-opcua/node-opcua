"use strict";
/*global describe,require,it,before*/
require("requirish")._(module);
var should = require("should");

var dumpReferences = require("lib/address_space/base_node").dumpReferences;
var dumpBrowseDescription = require("lib/address_space/base_node").dumpBrowseDescription;
var browse_service = require("lib/services/browse_service");
var redirectToFile = require("lib/misc/utils").redirectToFile;

var get_mini_address_space = require("test/fixtures/fixture_mininodeset_address_space").get_mini_address_space;

describe("testing address space", function () {

    var address_space = null;
    before(function (done) {
        get_mini_address_space(function (err, data) {
            address_space = data;
            done(err);
        });
    });

    it("should dump references", function (done) {

        var hr = address_space.findReferenceType("HierarchicalReferences");

        redirectToFile("dumpReferences.log", function () {
            dumpReferences(address_space, hr._references);
        }, done);

    });

    it("should dump a browseDescription", function (done) {
        var browseDescription = {
            browseDirection: browse_service.BrowseDirection.Both,
            referenceTypeId: "HierarchicalReferences",
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            resultMask: 0x3F
        };

        var hr = address_space.findReferenceType("HierarchicalReferences");
        redirectToFile("dumpBrowseDescription.log", function () {
            dumpBrowseDescription(hr, browseDescription);
        }, done);

    });

    it("should provide a convenient a way to construct the node full name ", function () {

        var obj = address_space.findObject("Server_ServerStatus_BuildInfo");
        obj.full_name().should.eql("Server.ServerStatus.BuildInfo");

    });
});
describe("testing dump browseDescriptions", function () {


    var address_space = null;
    before(function (done) {
        get_mini_address_space(function (err, data) {
            address_space = data;
            done(err);
        });
    });

    it("should provide a way to find a Method object by nodeId", function () {
        should(address_space.findMethod("ns=0;i=11489")).not.eql(null);
    });
});


