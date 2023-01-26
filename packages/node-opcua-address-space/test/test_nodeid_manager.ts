import "should";
import { makeNodeId, resolveNodeId } from "node-opcua-nodeid";
import { coerceQualifiedName, NodeClass } from "node-opcua-data-model";

import { AddressSpace, ConstructNodeIdOptions, NodeIdManager, getNodeIdManager, setSymbols } from "..";
import { generateAddressSpace } from "../nodeJS";
import { get_mini_nodeset_filename } from "../distHelpers";

// tslint:disable-next-line: no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("NodeIdManager", () => {
    const namespaceUri = "urn:namespace";
    let addressSpace: AddressSpace;
    let nodeIdManager: NodeIdManager;
    const nodeset = get_mini_nodeset_filename();
    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        const ns = addressSpace.registerNamespace(namespaceUri);
        const nodesetsXML: string[] = [nodeset];
        await generateAddressSpace(addressSpace, nodesetsXML);

        nodeIdManager = getNodeIdManager(ns);
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
        nodeIdManager.setSymbols([
            ["Person", 100, "ObjectType"],
            ["Person_Name", 200, "Variable"]
        ]);
        const options: ConstructNodeIdOptions = {
            browseName: coerceQualifiedName("AAA"),
            nodeClass: NodeClass.Variable,
            nodeId: "s=Hello",
            registerSymbolicNames: true
        };
        const nodeId1 = nodeIdManager.constructNodeId(options);
        nodeId1.toString().should.eql("ns=1;s=Hello");
    });

    it("should constructNodeId with ns=1;s=MyBoiler form", () => {
        const options: ConstructNodeIdOptions = {
            browseName: coerceQualifiedName("AAA"),
            nodeClass: NodeClass.Variable,
            nodeId: "ns=1;s=MyBoiler",
            registerSymbolicNames: true
        };
        const nodeId1 = nodeIdManager.constructNodeId(options);
        nodeId1.toString().should.eql("ns=1;s=MyBoiler");
    });

    it("should constructNodeId with i=123 form", () => {
        const options: ConstructNodeIdOptions = {
            browseName: coerceQualifiedName("AAA"),
            nodeClass: NodeClass.Variable,
            nodeId: "i=123",
            registerSymbolicNames: true
        };
        const nodeId1 = nodeIdManager.constructNodeId(options);
        nodeId1.toString().should.eql("ns=1;i=123");
    });

    it("should constructNodeId with CoercibleString form", () => {
        const options = {
            nodeId: "CloseSecureChannelRequest_Encoding_DefaultXml",
            nodeClass: NodeClass.Object,
            browseName: coerceQualifiedName("a"),
            registerSymbolicNames: true
        };
        // const nodeId1 = nodeIdManager.constructNodeId(options);
        // nodeId1.toString().should.eql("ns=1;i=1000");

        //  however, on namespace 0
        const nodeIdManager0 = new NodeIdManager(0, addressSpace);
        const nodeId2 = nodeIdManager0.constructNodeId(options);
        nodeId2.toString().should.eql("ns=0;i=451");
    });

    it("should constructNodeId with s=SomeName form", () => {
        nodeIdManager.setSymbols([["SomeName", 10001, "Variable"]]);
        const options = {
            browseName: coerceQualifiedName("AAA"),
            nodeClass: NodeClass.Variable,
            nodeId: "s=SomeName",
            registerSymbolicNames: true
        };
        const nodeId1 = nodeIdManager.constructNodeId(options);
        nodeId1.toString().should.eql("ns=1;s=SomeName");
    });

    it("should constructNodeId with SomeName_SomeProp form", () => {
        nodeIdManager.setSymbols([["SomeName", 10001, "Variable"]]);
        const options = {
            browseName: coerceQualifiedName("AAA"),
            nodeClass: NodeClass.Variable,
            registerSymbolicNames: true
        };
        const nodeId1 = nodeIdManager.constructNodeId(options);
        nodeId1.toString().should.eql("ns=1;i=1000");

        const nodeId2 = nodeIdManager.constructNodeId(options);
        nodeId2.toString().should.eql("ns=1;i=1000");
    });

    it("should maintain a list of Symbol and recycle the one that exists already", () => {

        const ns = addressSpace.getOwnNamespace();
        setSymbols(ns, [["SomeName", 1000, "Object"]]);

        (nodeIdManager as any)._isInCache(makeNodeId(1000, 1)).should.eql(true);

        const s = ns.addObject({
            browseName: "SomeName"
        });
        nodeIdManager.getSymbolCSV().should.eql(`SomeName;1000;Object`);

        s.nodeId.toString().should.eql("ns=1;i=1000");


        const p = ns.addVariable({
            browseName: "Property1",
            componentOf: s,
            dataType: "Double"
        });

        const nodeId1 = p.nodeId;
        nodeId1.toString().should.eql("ns=1;i=1001");

        nodeIdManager.getSymbolCSV().should.eql(`SomeName;1000;Object\nSomeName_Property1;1001;Variable`);

        const options2 = {
            browseName: coerceQualifiedName("Property1"),
            nodeClass: NodeClass.Variable,
            registerSymbolicNames: true,
            references: [
                {
                    isForward: false,
                    nodeId: s.nodeId,
                    referenceType: resolveNodeId("HasComponent"),
                }
            ],

        };
        const nodeId2 = nodeIdManager.constructNodeId(options2);
        nodeId2.toString().should.eql("ns=1;i=1001");

        nodeIdManager.getSymbolCSV().should.eql(`SomeName;1000;Object\nSomeName_Property1;1001;Variable`);
    });

});
