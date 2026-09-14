import type { ExtraDataTypeManager } from "node-opcua-client-dynamic-extension-object";
import { DataTypeIds } from "node-opcua-constants";
import { BrowseDirection, NodeClass } from "node-opcua-data-model";
import { coerceNodeId, type NodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { DataType } from "node-opcua-variant";
import should from "should";
import {
    AddressSpace,
    ensureDatatypeExtracted,
    type Namespace,
    type UADataType,
    type UAObject,
    type UAObjectType,
    type UAReferenceType
} from "../dist/api/index.js";
import { generateAddressSpace } from "../nodeJS.js";

/**
 * The state of every node of the address space, as a string per node: node class, browse name and
 * every reference it holds, whichever end declared it, sorted so that the order references were
 * installed in cannot show up as a difference.
 *
 * Deleting a namespace has to leave this untouched for the nodes of the namespaces it did not
 * touch. A model grafts its types onto the base ones (a HasSubtype from BaseObjectType, an
 * Organizes from the Objects folder) and every one of those grafts has to be undone; counting
 * nodes would not see a reference left behind, and probing a handful of well known nodes would
 * only see the ones the test thought to name.
 */
function snapshot(addressSpace: AddressSpace): Map<string, string> {
    const result = new Map<string, string>();
    for (const namespace of addressSpace.getNamespaceArray()) {
        for (const node of namespace.nodeIterator()) {
            const references = node
                .allReferences()
                .map((r) => `${r.isForward ? "->" : "<-"}${r.referenceType.toString()}:${r.nodeId.toString()}`)
                .sort();
            result.set(
                node.nodeId.toString(),
                `${NodeClass[node.nodeClass]} ${node.browseName.toString()} [${references.join(" ")}]`
            );
        }
    }
    return result;
}

/** the differences between two snapshots, at most `max` of them, as readable lines */
function diffSnapshot(before: Map<string, string>, after: Map<string, string>, max = 10): string[] {
    const lines: string[] = [];
    for (const [nodeId, value] of before) {
        if (!after.has(nodeId)) {
            lines.push(`missing ${nodeId} ${value}`);
        } else if (after.get(nodeId) !== value) {
            lines.push(`changed ${nodeId}\n    before: ${value}\n    after : ${after.get(nodeId)}`);
        }
        if (lines.length >= max) return lines;
    }
    for (const [nodeId, value] of after) {
        if (!before.has(nodeId)) {
            lines.push(`extra   ${nodeId} ${value}`);
        }
        if (lines.length >= max) return lines;
    }
    return lines;
}

interface NamespaceMapSizes {
    nodes: number;
    objectTypes: number;
    variableTypes: number;
    dataTypes: number;
    referenceTypes: number;
}

/** the four browse-name keyed maps a namespace registers its types in, plus its node index */
function mapSizes(namespace: Namespace): NamespaceMapSizes {
    return {
        nodes: [...namespace.nodeIterator()].length,
        objectTypes: namespace.objectTypeCount(),
        variableTypes: namespace.variableTypeCount(),
        dataTypes: namespace.dataTypeCount(),
        referenceTypes: namespace.referenceTypeCount()
    };
}

interface Populated {
    myObjectType: UAObjectType;
    myStructure: UADataType;
    myEnum: UADataType;
    myReferenceType: UAReferenceType;
    myDevice: UAObject;
}

/**
 * One of everything the deletion has to cope with: a type grafted onto a base type, a structure
 * DataType (which registers an ExtensionObject constructor), an enumeration DataType, a
 * ReferenceType (which goes in two maps), and instances organized by a base folder.
 */
function populate(addressSpace: AddressSpace, namespace: Namespace): Populated {
    const myEnum = namespace.addEnumerationType({
        browseName: "MyEnum",
        enumeration: ["Red", "Green", "Blue"]
    });

    const myStructure = namespace.createDataType({
        browseName: "MyStructure",
        isAbstract: false,
        subtypeOf: "Structure",
        partialDefinition: [
            { dataType: coerceNodeId(DataTypeIds.Double), name: "Value1", valueRank: -1 },
            { dataType: coerceNodeId(DataTypeIds.String), name: "Value2", valueRank: -1 },
            { dataType: myEnum.nodeId, name: "Colour", valueRank: -1 }
        ]
    });

    const myReferenceType = namespace.addReferenceType({
        browseName: "MyReferenceType",
        inverseName: "MyInverseReferenceType",
        isAbstract: false,
        subtypeOf: "NonHierarchicalReferences"
    });

    const myObjectType = namespace.addObjectType({
        browseName: "MyObjectType",
        subtypeOf: "BaseObjectType"
    });
    namespace.addVariable({
        browseName: "Setting",
        componentOf: myObjectType,
        dataType: "Double",
        modellingRule: "Mandatory"
    });

    const myDevice = myObjectType.instantiate({
        // instantiate would otherwise put the instance in the address space's own namespace,
        // which here is a base one
        namespace,
        browseName: "MyDevice",
        organizedBy: addressSpace.rootFolder.objects
    });

    const other = namespace.addObject({
        browseName: "Other",
        organizedBy: addressSpace.rootFolder.objects
    });
    // a reference of the namespace's own reference type, between two of its own nodes
    myDevice.addReference({ isForward: true, nodeId: other.nodeId, referenceType: myReferenceType.nodeId });

    // a variable of the namespace's structure DataType, held by a base folder
    namespace.addVariable({
        browseName: "MyStructureValue",
        organizedBy: addressSpace.rootFolder.objects,
        dataType: myStructure.nodeId
    });

    return { myObjectType, myStructure, myEnum, myReferenceType, myDevice };
}

describe("AddressSpace#deleteNamespace", function (this: Mocha.Suite) {
    this.timeout(200000);

    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let index: number;
    let baseSnapshot: Map<string, string>;
    let emptyMapSizes: NamespaceMapSizes;

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di]);
        await ensureDatatypeExtracted(addressSpace);

        namespace = addressSpace.registerNamespace("urn:node-opcua:test:delete-namespace");
        index = namespace.index;

        baseSnapshot = snapshot(addressSpace);
        emptyMapSizes = mapSizes(namespace);
    });

    after(() => {
        addressSpace.dispose();
    });

    it("DN1 should refuse to delete the standard namespace", () => {
        should(() => addressSpace.deleteNamespace(0)).throw(/standard namespace/);
        should(() => addressSpace.deleteNamespace("http://opcfoundation.org/UA/")).throw(/standard namespace/);
    });

    it("DN2 should delete a DataType and a ReferenceType, which deleteNode used to refuse", () => {
        const dataType = namespace.createDataType({
            browseName: "DeletableDataType",
            isAbstract: false,
            subtypeOf: "Structure",
            partialDefinition: [{ dataType: coerceNodeId(DataTypeIds.Double), name: "Value", valueRank: -1 }]
        });
        const referenceType = namespace.addReferenceType({
            browseName: "DeletableReferenceType",
            inverseName: "DeletableInverseName",
            isAbstract: false,
            subtypeOf: "NonHierarchicalReferences"
        });

        should.exist(namespace.findDataType("DeletableDataType"));
        should.exist(namespace.findReferenceType("DeletableReferenceType"));
        should.exist(namespace.findReferenceTypeFromInverseName("DeletableInverseName"));

        addressSpace.deleteNode(dataType.nodeId);
        addressSpace.deleteNode(referenceType.nodeId);

        should.not.exist(addressSpace.findNode(dataType.nodeId));
        should.not.exist(addressSpace.findNode(referenceType.nodeId));
        should.not.exist(namespace.findDataType("DeletableDataType"));
        should.not.exist(namespace.findReferenceType("DeletableReferenceType"));
        should.not.exist(namespace.findReferenceTypeFromInverseName("DeletableInverseName"));

        // and the base type it was grafted onto is back where it was
        diffSnapshot(baseSnapshot, snapshot(addressSpace)).should.eql([]);
    });

    it("DN3 should empty a populated namespace and leave the rest of the address space as it was", async () => {
        const { myObjectType, myStructure, myReferenceType, myDevice } = populate(addressSpace, namespace);

        // the model is grafted onto the base
        const baseObjectType = addressSpace.findObjectType("BaseObjectType")!;
        baseObjectType
            .findReferencesEx("HasSubtype", BrowseDirection.Forward)
            .some((r) => r.nodeId.toString() === myObjectType.nodeId.toString())
            .should.eql(true, "MyObjectType must be a subtype of BaseObjectType");

        const objects = addressSpace.rootFolder.objects;
        const organizes = () => objects.findReferencesEx("Organizes", BrowseDirection.Forward);
        organizes()
            .some((r) => r.nodeId.toString() === myDevice.nodeId.toString())
            .should.eql(true, "MyDevice must be organized by the Objects folder");
        // ... and reachable as a javascript property of the base folder
        should.exist(Object.getOwnPropertyDescriptor(objects, "myDevice"));

        mapSizes(namespace).nodes.should.be.greaterThan(emptyMapSizes.nodes);

        // the structure DataType registered a constructor with the address space
        const dataTypeManager: ExtraDataTypeManager = await ensureDatatypeExtracted(addressSpace);
        dataTypeManager.hasDataTypeFactory(index).should.eql(true);
        const constructorBefore = addressSpace.getExtensionObjectConstructor(myStructure);
        should.exist(constructorBefore);

        const populatedNodeIds = [...namespace.nodeIterator()].map((n) => n.nodeId.toString());
        populatedNodeIds.length.should.be.greaterThan(5);

        // ------------------------------------------------------------------ delete
        addressSpace.deleteNamespace(index);

        // the namespace is empty, and its four type maps with it
        mapSizes(namespace).should.eql(emptyMapSizes);
        should.not.exist(namespace.findObjectType("MyObjectType"));
        should.not.exist(namespace.findDataType("MyStructure"));
        should.not.exist(namespace.findReferenceType("MyReferenceType"));
        should.not.exist(namespace.findReferenceTypeFromInverseName("MyInverseReferenceType"));
        should.not.exist(addressSpace.findReferenceType(myReferenceType.nodeId));

        for (const nodeId of populatedNodeIds) {
            should.not.exist(addressSpace.findNode(nodeId), `node ${nodeId} should be gone`);
        }

        // the namespace itself survives, under the same index and uri
        addressSpace.getNamespace(index).should.equal(namespace);
        addressSpace.getNamespaceIndex(namespace.namespaceUri).should.eql(index);

        // the grafts on the base nodes are undone - every one of them
        const differences = diffSnapshot(baseSnapshot, snapshot(addressSpace));
        differences.should.eql([], `the base address space changed:\n${differences.join("\n")}`);

        organizes()
            .some((r) => r.nodeId.namespace === index)
            .should.eql(false, "nothing in the Objects folder may point into the deleted namespace");
        should.not.exist(Object.getOwnPropertyDescriptor(objects, "myDevice"), "the child accessor must go too");
        myDevice.isDisposed().should.eql(true, "a deleted node is disposed");

        // the DataType factory of the namespace has gone with it
        dataTypeManager.hasDataTypeFactory(index).should.eql(false);
    });

    it("DN4 should let the namespace be populated again, to the same result", async () => {
        // (DN3 emptied it) populate once, snapshot, empty, populate again, compare
        const first = populate(addressSpace, namespace);
        await ensureDatatypeExtracted(addressSpace);
        const firstSnapshot = snapshot(addressSpace);
        const firstSizes = mapSizes(namespace);
        const firstStructureNodeId = first.myStructure.nodeId.toString();
        const firstConstructor = addressSpace.getExtensionObjectConstructor(first.myStructure);
        const firstExtObj = new firstConstructor({ value1: 42, value2: "hello" });
        (firstExtObj as unknown as { value1: number }).value1.should.eql(42);

        addressSpace.deleteNamespace(index);
        diffSnapshot(baseSnapshot, snapshot(addressSpace)).should.eql([]);

        const second = populate(addressSpace, namespace);
        await ensureDatatypeExtracted(addressSpace);

        // the same nodes, with the same nodeIds and the same references
        mapSizes(namespace).should.eql(firstSizes);
        second.myStructure.nodeId.toString().should.eql(firstStructureNodeId, "a recycled namespace hands out the same ids");
        const differences = diffSnapshot(firstSnapshot, snapshot(addressSpace));
        differences.should.eql([], `the second population differs:\n${differences.join("\n")}`);

        // a fresh constructor, built from the new nodes rather than the leftovers of the old
        const secondConstructor = addressSpace.getExtensionObjectConstructor(second.myStructure);
        should.notEqual(secondConstructor, firstConstructor, "the constructor must be rebuilt, not reused");
        const secondExtObj = new secondConstructor({ value1: 7, value2: "world" });
        (secondExtObj as unknown as { value1: number }).value1.should.eql(7);

        // leave the address space empty again for the next test
        addressSpace.deleteNamespace(namespace.namespaceUri);
        diffSnapshot(baseSnapshot, snapshot(addressSpace)).should.eql([]);
    });

    it("DN5 should not report model changes while they are suspended", () => {
        const objects = addressSpace.rootFolder.objects;

        const collected: NodeId[] = [];
        const addressSpacePrivate = addressSpace as unknown as {
            _collectModelChange: (view: unknown, change: { affected: NodeId }) => void;
        };
        const original = addressSpacePrivate._collectModelChange.bind(addressSpace);
        addressSpacePrivate._collectModelChange = (view, change) => {
            collected.push(change.affected);
            original(view, change);
        };

        try {
            // a node with a NodeVersion is what makes the bookkeeping produce anything at all
            const versioned = namespace.addObject({
                browseName: "Versioned",
                nodeVersion: "1",
                organizedBy: objects
            });
            const child = namespace.addObject({ browseName: "Child", componentOf: versioned });
            collected.length.should.be.greaterThan(0, "a versioned parent must report its new child");

            collected.length = 0;
            addressSpace.deleteNode(child.nodeId);
            collected.length.should.be.greaterThan(0, "a versioned parent must report its deleted child");

            collected.length = 0;
            addressSpace.suspendModelChangeEvents = true;
            const child2 = namespace.addObject({ browseName: "Child2", componentOf: versioned });
            addressSpace.deleteNode(child2.nodeId);
            collected.length.should.eql(0, "nothing is collected while suspended");
        } finally {
            addressSpace.suspendModelChangeEvents = false;
            addressSpacePrivate._collectModelChange = original;
        }

        addressSpace.deleteNamespace(index);
        diffSnapshot(baseSnapshot, snapshot(addressSpace)).should.eql([]);
    });

    it("DN6 should delete a namespace built with model changes suspended", () => {
        addressSpace.suspendModelChangeEvents = true;
        try {
            populate(addressSpace, namespace);
            addressSpace.deleteNamespace(index);
        } finally {
            addressSpace.suspendModelChangeEvents = false;
        }
        mapSizes(namespace).should.eql(emptyMapSizes);
        diffSnapshot(baseSnapshot, snapshot(addressSpace)).should.eql([]);
    });

    it("DN7 should sever a reference a node of another namespace holds to one of ours", () => {
        const { myDevice } = populate(addressSpace, namespace);

        // a node of namespace 0 pointing at one of ours, declared from the far end
        const server = addressSpace.rootFolder.objects.server;
        server.addReference({ isForward: true, nodeId: myDevice.nodeId, referenceType: "Organizes" });
        server
            .findReferencesEx("Organizes", BrowseDirection.Forward)
            .some((r) => r.nodeId.toString() === myDevice.nodeId.toString())
            .should.eql(true);

        addressSpace.deleteNamespace(index);

        server
            .findReferencesEx("Organizes", BrowseDirection.Forward)
            .some((r) => r.nodeId.namespace === index)
            .should.eql(false, "the Organizes reference into the deleted namespace must be gone");
        diffSnapshot(baseSnapshot, snapshot(addressSpace)).should.eql([]);
    });

    it("DN8 should not lose a historized variable of another namespace", () => {
        const variable = namespace.addVariable({
            browseName: "Historized",
            organizedBy: addressSpace.rootFolder.objects,
            dataType: DataType.Double
        });
        addressSpace.installHistoricalDataNode(variable);
        [...addressSpace.historizingNodes!].some((n) => n.nodeId.namespace === index).should.eql(true);

        addressSpace.deleteNamespace(index);

        [...addressSpace.historizingNodes!]
            .some((n) => n.nodeId.namespace === index)
            .should.eql(false, "the deleted variable must not stay in historizingNodes");

        // no snapshot comparison here: installHistoricalDataNode puts its "HA Configuration"
        // object in the address space's OWN namespace, which in this fixture is a base one, so
        // those nodes legitimately outlive the namespace whose variable asked for them
        [...namespace.nodeIterator()].length.should.eql(emptyMapSizes.nodes);
    });
});

/**
 * The recycle as a compiler performs it: load the base nodesets once, then load, drop and reload
 * the model's nodeset into its own namespace. This is the case the whole thing exists for, and a
 * hand-built namespace does not prove it - a real nodeset brings structure and enumeration
 * DataTypes, encodings, reference types and several hundred nodes wired to the base.
 */
describe("AddressSpace#deleteNamespace - reloading a nodeset into the same namespace", function (this: Mocha.Suite) {
    this.timeout(200000);

    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di]);
        await ensureDatatypeExtracted(addressSpace);
    });

    after(() => {
        addressSpace.dispose();
    });

    it("DN9 should load, delete and reload a nodeset, leaving the base untouched and the model identical", async () => {
        const baseSnapshot = snapshot(addressSpace);
        const baseNamespaceCount = addressSpace.getNamespaceArray().length;

        await generateAddressSpace(addressSpace, [nodesets.autoId]);

        const index = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");
        index.should.be.greaterThan(0);
        const namespace = addressSpace.getNamespace(index);
        const loadedNodeCount = [...namespace.nodeIterator()].length;
        loadedNodeCount.should.be.greaterThan(100, "the AutoID nodeset is not a toy");

        const loadedSnapshot = snapshot(addressSpace);

        // ------------------------------------------------------------------ delete
        addressSpace.deleteNamespace(index);

        [...namespace.nodeIterator()].length.should.eql(0);
        namespace.objectTypeCount().should.eql(0);
        namespace.variableTypeCount().should.eql(0);
        namespace.dataTypeCount().should.eql(0);
        namespace.referenceTypeCount().should.eql(0);
        // the namespace stays registered, so the indexes of the namespaces around it do not move
        addressSpace.getNamespaceArray().length.should.eql(baseNamespaceCount + 1);

        const afterDelete = diffSnapshot(baseSnapshot, snapshot(addressSpace));
        afterDelete.should.eql([], `the base address space changed:\n${afterDelete.join("\n")}`);

        // ------------------------------------------------------------------ reload
        await generateAddressSpace(addressSpace, [nodesets.autoId]);

        addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/").should.eql(index, "the index must not move");
        [...namespace.nodeIterator()].length.should.eql(loadedNodeCount);

        const afterReload = diffSnapshot(loadedSnapshot, snapshot(addressSpace));
        afterReload.should.eql([], `the reloaded namespace differs from the first load:\n${afterReload.join("\n")}`);

        // and its structures decode again, through a constructor built from the reloaded nodes
        const rfidScanResult = addressSpace.findDataType("RfidScanResult", index);
        should.exist(rfidScanResult, "the AutoID nodeset defines RfidScanResult");
        const Constructor = addressSpace.getExtensionObjectConstructor(rfidScanResult!);
        should.exist(new Constructor({}));
    });
});
