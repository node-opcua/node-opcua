import { NodeClass } from "node-opcua-data-model";
import * as should from "should";
import { AddressSpace, Namespace } from "..";
const _should = should;

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("AddressSpace Namespace", () => {
    it("should create a namespace", () => {
        const addressSpace = AddressSpace.create();

        const namespace = addressSpace.registerNamespace("https://mynamespace");
        namespace.index.should.eql(1);

        const namespace2 = addressSpace.registerNamespace("https://mynamespace");
        namespace2.index.should.eql(1);

        addressSpace.dispose();
    });

    it("should create several namespaces", () => {
        const addressSpace = AddressSpace.create();

        const namespace2 = addressSpace.registerNamespace("https://mynamespace");
        namespace2.index.should.eql(1);

        const namespace = addressSpace.getNamespace("https://mynamespace");
        namespace.namespaceUri.should.eql("https://mynamespace");
        addressSpace.dispose();
    });

    it("should create a object in the namespace (with internalCreateNode)", () => {
        const addressSpace = AddressSpace.create();
        const namespace1 = addressSpace.registerNamespace("https://mynamespace");

        const node = namespace1.internalCreateNode({
            browseName: "Toto",
            nodeClass: NodeClass.Object,
            nodeId: "s=TOTO"
        });

        node.browseName.toString().should.eql("1:Toto");
        node.browseName.namespaceIndex.should.eql(namespace1.index);
        node.nodeId.namespace.should.eql(namespace1.index);

        const nodeFound = namespace1.findNode(node.nodeId.toString())!;
        nodeFound.should.eql(node);

        addressSpace.dispose();
    });
});
