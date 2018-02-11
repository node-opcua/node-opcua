"use strict";
/* global it,before*/

var should = require("should");
var get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing github issue https://github.com/node-opcua/node-opcua/issues/432", function () {

    var addressSpace;
    before(function (done) {
        get_mini_address_space(function (err, __addressSpace__) {
            addressSpace = __addressSpace__;
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

    it("should be possible to specify a custom nodeId when creating an object type", function () {

        var customObjectType = addressSpace.addObjectType({
            browseName:"MyCustomType",
            nodeId: "ns=4;i=42"
        });
        customObjectType.nodeId.toString().should.eql("ns=4;i=42");
    });
});
