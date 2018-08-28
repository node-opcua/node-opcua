"use strict";

const should = require("should");
const assert = require("node-opcua-assert").assert;
const NodeClass = require("node-opcua-data-model").NodeClass;
const AddressSpace = require("..").AddressSpace;


const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("AddressSpace Namespace",function() {

    it("should create a namespace", function () {
        const addressSpace = new AddressSpace();

        const namespace = addressSpace.registerNamespace("https://mynamespace");
        namespace.index.should.eql(1);

        const namespace2 = addressSpace.registerNamespace("https://mynamespace");
        namespace2.index.should.eql(1);

        addressSpace.dispose();
    });


    it("should create several namespaces", function () {
        const addressSpace = new AddressSpace();

        const namespace2 = addressSpace.registerNamespace("https://mynamespace");
        namespace2.index.should.eql(1);

        const namespace = addressSpace.getNamespace("https://mynamespace");
        namespace.namespaceUri.should.eql("https://mynamespace");
        addressSpace.dispose();

    });

    it("should create a object in the namespace", function () {

        const addressSpace = new AddressSpace();
        const namespace1 = addressSpace.registerNamespace("https://mynamespace");

        const node = namespace1._createNode({
            nodeClass: NodeClass.Object,
            browseName: "Toto",
            nodeId: namespace1._build_new_NodeId()
        });

        node.browseName.toString().should.eql("1:Toto");
        node.browseName.namespaceIndex.should.eql(namespace1.index);
        node.nodeId.namespace.should.eql(namespace1.index);

        const nodeFound = namespace1.findNode(node.nodeId.toString());
        nodeFound.should.eql(node);

        addressSpace.dispose();
    });
});