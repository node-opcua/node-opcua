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

        // assuming that the namspace exist !!!
        const ns2 = addressSpace.registerNamespace("N2");
        const ns3 = addressSpace.registerNamespace("N3");
        const ns4 = addressSpace.registerNamespace("N4");
        const ns5 = addressSpace.registerNamespace("N5");
        const ns6 = addressSpace.registerNamespace("N6");
        addressSpace.getNamespaceArray().length.should.be.greaterThan(4);
        const customObjectType = ns4.addObjectType({
            browseName:"MyCustomType",
            nodeId: "i=42"
        });
        customObjectType.nodeId.toString().should.eql("ns=4;i=42");
    });
});
