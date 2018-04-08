"use strict";
/* global it,before*/

const should = require("should");
const get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing github issue https://github.com/node-opcua/node-opcua/issues/432", function () {

    let addressSpace;
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

        const customObjectType = addressSpace.addObjectType({
            browseName:"MyCustomType",
            nodeId: "ns=4;i=42"
        });
        customObjectType.nodeId.toString().should.eql("ns=4;i=42");
    });
});
