"use strict";

const should = require("should");
const assert = require("node-opcua-assert").assert;

const AddressSpace = require("../index").AddressSpace;


describe("AddressSpace Namespace",function() {

    it("should create a namespace",function() {
        const addressSpace = new AddressSpace();

        const namespace= addressSpace.registerNamespace("https://mynamespace");
        namespace.index.should.eql(1);

        const namespace2 = addressSpace.registerNamespace("https://mynamespace");
        namespace2.index.should.eql(1);

        addressSpace.dispose();
    });

    it("should create a namespace",function() {
        const addressSpace = new AddressSpace();

        const namespace2 = addressSpace.registerNamespace("https://mynamespace");
        namespace2.index.should.eql(1);

        const namespace= addressSpace.getNamespace("https://mynamespace");
        namespace.namespaceUri.should.eql("https://mynamespace");
        addressSpace.dispose();

    })

});