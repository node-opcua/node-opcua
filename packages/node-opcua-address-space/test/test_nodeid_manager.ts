import "should";
import { resolveNodeId } from "node-opcua-nodeid";
import { coerceQualifiedName, NodeClass } from "node-opcua-data-model";

import { AddressSpace, ConstructNodeIdOptions, NodeIdManager } from "..";
import { generateAddressSpace } from "../nodeJS";

// tslint:disable-next-line: no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("NodeIdManager", () => {
    const namespaceUri = "urn:namespace";
    let addressSpace: AddressSpace;
    let nodeIdManager: NodeIdManager;

    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        const ns = addressSpace.registerNamespace(namespaceUri);
        const nodesetsXML: string[] = [];
        await generateAddressSpace(addressSpace, nodesetsXML);

        nodeIdManager = new NodeIdManager(1, addressSpace);
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    it("should register a new node id", () => {
        const index = 1;
        const nodeId = nodeIdManager.buildNewNodeId();
        nodeId.toString().should.eql("ns=1;i=1000");
    });

    it("should register a new node id", () => {
        const index = 1;

        const nodeId1 = nodeIdManager.buildNewNodeId();
        nodeId1.toString().should.eql("ns=1;i=1000");

        const nodeId2 = nodeIdManager.buildNewNodeId();
        nodeId2.toString().should.eql("ns=1;i=1001");
    });

    it("should constructNodeId with s=STRING form", () => {
        nodeIdManager.setCache([
            ["Person", 100, NodeClass.ObjectType],
            ["Person_Name", 200, NodeClass.Variable]
        ]);
        const options: ConstructNodeIdOptions = {
            browseName: coerceQualifiedName("AAA"),
            nodeClass: NodeClass.Variable,
            nodeId: "s=Hello"
        };
        const nodeId1 = nodeIdManager.constructNodeId(options);
        nodeId1.toString().should.eql("ns=1;s=Hello");
    });

    it("should constructNodeId with ns=1;s=MyBoiler form", () => {
        const options: ConstructNodeIdOptions = {
            browseName: coerceQualifiedName("AAA"),
            nodeClass: NodeClass.Variable,
            nodeId: "ns=1;s=MyBoiler"
        };
        const nodeId1 = nodeIdManager.constructNodeId(options);
        nodeId1.toString().should.eql("ns=1;s=MyBoiler");
    });

    it("should constructNodeId with i=123 form", () => {
        const options: ConstructNodeIdOptions = {
            browseName: coerceQualifiedName("AAA"),
            nodeClass: NodeClass.Variable,
            nodeId: "i=123"
        };
        const nodeId1 = nodeIdManager.constructNodeId(options);
        nodeId1.toString().should.eql("ns=1;i=123");
    });

    it("should constructNodeId with CoercibleString form", () => {
        const options = {
            nodeId: "CloseSecureChannelRequest_Encoding_DefaultXml",
            nodeClass: NodeClass.Object,
            browseName: coerceQualifiedName("a")
        };
        const nodeId1 = nodeIdManager.constructNodeId(options);
        nodeId1.toString().should.eql("ns=1;i=1000");

        //  however, on namespace 0
        const nodeIdManager0 = new NodeIdManager(0, addressSpace);
        const nodeId2 = nodeIdManager0.constructNodeId(options);
        nodeId2.toString().should.eql("ns=0;i=451");
    });

    it("should constructNodeId with SomeName form", () => {
        nodeIdManager.setCache([["SomeName", 10001, NodeClass.Variable]]);
        const options = {
            browseName: coerceQualifiedName("AAA"),
            nodeClass: NodeClass.Variable,
            nodeId: "SomeName"
        };
        const nodeId1 = nodeIdManager.constructNodeId(options);
        nodeId1.toString().should.eql("ns=1;i=10001");
    });

    it("should constructNodeId with SomeName_SomeProp form", () => {
        nodeIdManager.setCache([["SomeName", 10001, NodeClass.Variable]]);
        const options = {
            browseName: coerceQualifiedName("AAA"),
            nodeClass: NodeClass.Variable,
            nodeId: "SomeName_SomeProp"
        };
        const nodeId1 = nodeIdManager.constructNodeId(options);
        nodeId1.toString().should.eql("ns=1;i=1000");

        const nodeId2 = nodeIdManager.constructNodeId(options);
        nodeId2.toString().should.eql("ns=1;i=1000");
    });

    it("should maintain a list of Symbol and recycle the one that exists already", () => {
        nodeIdManager.setCache([["SomeName", 1000, NodeClass.Object]]);

        (nodeIdManager as any)._isInCache(1000).should.eql(true);

        nodeIdManager.findParentNodeId = () => {
            return [resolveNodeId(1000), ""];
        };

        const options = { browseName: coerceQualifiedName("Property1"), nodeClass: NodeClass.Variable };
        const nodeId1 = nodeIdManager.constructNodeId(options);
        nodeId1.toString().should.eql("ns=1;i=1001");
        nodeIdManager.getSymbolCSV().should.eql(`SomeName;1000;Object\nSomeName_Property1;1001;Variable`);

        const options2 = {
            browseName: coerceQualifiedName("Property1"),
            nodeClass: NodeClass.Variable,
            nodeId: "SomeName_Property1"
        };
        const nodeId2 = nodeIdManager.constructNodeId(options2);
        nodeId2.toString().should.eql("ns=1;i=1001");

        nodeIdManager.getSymbolCSV().should.eql(`SomeName;1000;Object\nSomeName_Property1;1001;Variable`);
    });

    it("should maintain a list of Symbol and recycle the one that exists already", () => {
        const options1 = {
            browseName: coerceQualifiedName("MyNewDataType"),
            nodeClass: NodeClass.ObjectType,
            references: []
        };

        const nodeId1 = nodeIdManager.constructNodeId(options1);
        nodeId1.toString().should.eql("ns=1;i=1000");
        nodeIdManager.getSymbolCSV().should.eql(`MyNewDataType;1000;ObjectType`);

        nodeIdManager.findParentNodeId = () => [nodeId1, ""];

        const options2 = {
            browseName: coerceQualifiedName("Property1"),
            nodeClass: NodeClass.Variable
        };
        const nodeId2 = nodeIdManager.constructNodeId(options2);
        nodeId2.toString().should.eql("ns=1;i=1001");

        nodeIdManager.getSymbolCSV().should.eql(`MyNewDataType;1000;ObjectType\nMyNewDataType_Property1;1001;Variable`);
    });
});
