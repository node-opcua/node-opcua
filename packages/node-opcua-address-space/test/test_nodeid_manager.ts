import "should";
import { coerceQualifiedName, NodeClass } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { makeNodeId, resolveNodeId } from "node-opcua-nodeid";
import { AddressSpace, type ConstructNodeIdOptions, getNodeIdManager, NodeIdManager, setSymbols } from "..";
import { get_mini_nodeset_filename } from "../distHelpers";
import { generateAddressSpace } from "../nodeJS";

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
        const _index = 1;
        const nodeId = nodeIdManager.buildNewNodeId();
        nodeId.toString().should.eql("ns=1;i=1000");
    });

    it("should register a new node id", () => {
        const _index = 1;

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
            // mirror what internalCreateNode() does for a plain string browseName: it resolves to
            // this namespace's own index, not the QualifiedName default of 0.
            browseName: coerceQualifiedName({ name: "Property1", namespaceIndex: ns.index }),
            nodeClass: NodeClass.Variable,
            registerSymbolicNames: true,
            references: [
                {
                    isForward: false,
                    nodeId: s.nodeId,
                    referenceType: resolveNodeId("HasComponent")
                }
            ]
        };
        const nodeId2 = nodeIdManager.constructNodeId(options2);
        nodeId2.toString().should.eql("ns=1;i=1001");

        nodeIdManager.getSymbolCSV().should.eql(`SomeName;1000;Object\nSomeName_Property1;1001;Variable`);
    });

    it("should not collide when two children share the same local name but different browseName namespaces", () => {
        // simulates an inherited 4:ActualSpeed and an overriding 1:ActualSpeed under the same parent
        const ns = addressSpace.getOwnNamespace();
        setSymbols(ns, []);
        const parent = ns.addObject({ browseName: "ParameterSet" });

        const child1 = ns.addVariable({
            browseName: { name: "ActualSpeed", namespaceIndex: 4 },
            componentOf: parent,
            dataType: "Double"
        });
        const child2 = ns.addVariable({
            browseName: { name: "ActualSpeed", namespaceIndex: 1 },
            componentOf: parent,
            dataType: "Double"
        });

        child1.nodeId.toString().should.not.eql(child2.nodeId.toString());
    });

    it("should not hand out an occupied nodeId to a different node when the symbol-cache key collides", () => {
        const ns = addressSpace.getOwnNamespace();
        setSymbols(ns, []);
        const parent1 = ns.addObject({ browseName: "Parent1" });
        const parent2 = ns.addObject({ browseName: "Parent2" });

        const firstChild = ns.addVariable({
            browseName: "EngineeringUnits",
            componentOf: parent1,
            dataType: "Double"
        });

        // force a symbol-cache collision: pretend a previous (buggy) run mapped the *real* key
        // that a (parent2, EngineeringUnits) child resolves to ("Parent2_EngineeringUnits") onto
        // the already-occupied nodeId of firstChild (a child of parent1).
        const collidingKey = "Parent2_EngineeringUnits";
        (nodeIdManager as any)._cacheSymbolicName[collidingKey] = [firstChild.nodeId.value as number, NodeClass.Variable];

        const options: ConstructNodeIdOptions = {
            // mirror what internalCreateNode() does for a plain string browseName: it resolves to
            // this namespace's own index, not the QualifiedName default of 0.
            browseName: coerceQualifiedName({ name: "EngineeringUnits", namespaceIndex: ns.index }),
            nodeClass: NodeClass.Variable,
            registerSymbolicNames: true,
            references: [{ isForward: false, nodeId: parent2.nodeId, referenceType: resolveNodeId("HasComponent") }]
        };
        const nodeId = nodeIdManager.constructNodeId(options);

        nodeId.toString().should.not.eql(firstChild.nodeId.toString());
    });

    it("should keep returning the same nodeId for a genuine duplicate (same browseName and same parent)", () => {
        const ns = addressSpace.getOwnNamespace();
        setSymbols(ns, []);
        const parent = ns.addObject({ browseName: "Parent1" });

        const firstChild = ns.addVariable({
            browseName: "EngineeringUnits",
            componentOf: parent,
            dataType: "Double"
        });

        const options: ConstructNodeIdOptions = {
            // mirror what internalCreateNode() does for a plain string browseName: it resolves to
            // this namespace's own index, not the QualifiedName default of 0.
            browseName: coerceQualifiedName({ name: "EngineeringUnits", namespaceIndex: ns.index }),
            nodeClass: NodeClass.Variable,
            registerSymbolicNames: true,
            references: [{ isForward: false, nodeId: parent.nodeId, referenceType: resolveNodeId("HasComponent") }]
        };
        const nodeId = nodeIdManager.constructNodeId(options);

        // a genuine duplicate must still resolve to the same id, so that downstream
        // registerNode() raises its "already registered" error as before.
        nodeId.toString().should.eql(firstChild.nodeId.toString());
    });

    it("should not reuse a cached id when the occupant has a different browseName under the same parent", () => {
        const ns = addressSpace.getOwnNamespace();
        setSymbols(ns, []);
        const parent = ns.addObject({ browseName: "Parent1" });

        const firstChild = ns.addVariable({
            browseName: "EngineeringUnits",
            componentOf: parent,
            dataType: "Double"
        });

        // force a symbol-cache collision: pretend a previous (buggy) run mapped the *real* key
        // that a (parent, InstrumentRange) child resolves to ("Parent1_InstrumentRange") onto the
        // already-occupied nodeId of firstChild ("Parent1_EngineeringUnits" for real).
        const collidingKey = "Parent1_InstrumentRange";
        (nodeIdManager as any)._cacheSymbolicName[collidingKey] = [firstChild.nodeId.value as number, NodeClass.Variable];

        const options: ConstructNodeIdOptions = {
            // mirror what internalCreateNode() does for a plain string browseName: it resolves to
            // this namespace's own index, not the QualifiedName default of 0.
            browseName: coerceQualifiedName({ name: "InstrumentRange", namespaceIndex: ns.index }),
            nodeClass: NodeClass.Variable,
            registerSymbolicNames: true,
            references: [{ isForward: false, nodeId: parent.nodeId, referenceType: resolveNodeId("HasComponent") }]
        };
        const nodeId = nodeIdManager.constructNodeId(options);

        nodeId.toString().should.not.eql(firstChild.nodeId.toString());
    });

    it("should recognize a genuine duplicate among top-level nodes that have no parent", () => {
        const ns = addressSpace.getOwnNamespace();
        setSymbols(ns, []);

        // a top-level node has no componentOf/organizedBy, so parentNodeId is undefined
        const firstChild = ns.addObject({ browseName: "TopLevelObject" });

        const options: ConstructNodeIdOptions = {
            // mirror what internalCreateNode() does for a plain string browseName: it resolves to
            // this namespace's own index, not the QualifiedName default of 0.
            browseName: coerceQualifiedName({ name: "TopLevelObject", namespaceIndex: ns.index }),
            nodeClass: NodeClass.Object,
            registerSymbolicNames: true
        };
        const nodeId = nodeIdManager.constructNodeId(options);

        nodeId.toString().should.eql(firstChild.nodeId.toString());
    });

    it("should not reuse a top-level cached id for a lookup that resolves to a real parent", () => {
        const ns = addressSpace.getOwnNamespace();
        setSymbols(ns, []);

        // a top-level occupant (no parent)
        const firstChild = ns.addObject({ browseName: "SharedName" });

        // force a collision: pretend a previous (buggy) run mapped the *real* key that a
        // (parent, SharedName) child resolves to ("SomeParent_SharedName") onto the
        // already-occupied nodeId of the top-level firstChild.
        const parent = ns.addObject({ browseName: "SomeParent" });
        (nodeIdManager as any)._cacheSymbolicName.SomeParent_SharedName = [firstChild.nodeId.value as number, NodeClass.Object];

        const options: ConstructNodeIdOptions = {
            // mirror what internalCreateNode() does for a plain string browseName: it resolves to
            // this namespace's own index, not the QualifiedName default of 0.
            browseName: coerceQualifiedName({ name: "SharedName", namespaceIndex: ns.index }),
            nodeClass: NodeClass.Object,
            registerSymbolicNames: true,
            references: [{ isForward: false, nodeId: parent.nodeId, referenceType: resolveNodeId("HasComponent") }]
        };
        const nodeId = nodeIdManager.constructNodeId(options);

        nodeId.toString().should.not.eql(firstChild.nodeId.toString());
    });
});
