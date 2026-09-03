/**
 * The memoized reference scans of a node (findReferencesEx on nodes with many references) must
 * answer exactly what a fresh scan answers: with every target that exists resolved, following
 * the reference-type hierarchy as it stands, and without being changed by a caller.
 */
import { BrowseDirection, NodeClass } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";
import should from "should";
import { AddressSpace, type Namespace, type UAObject, type UAObjectType, type UAReferenceType } from "../dist/api/index.js";
import { getMiniAddressSpace } from "../test_helpers/get_mini_address_space.js";

describe("the memoized reference scans", function (this: Mocha.Suite) {
    this.timeout(60000);

    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let counter = 0;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
    });
    after(() => {
        addressSpace.dispose();
    });

    /** an object with enough references for its scans to be memoized */
    function busyObject(browseName: string, options: { organizedBy?: UAObject; componentOf?: UAObject } = {}): UAObject {
        const node = namespace.addObject({ browseName, organizedBy: addressSpace.rootFolder.objects, ...options });
        for (let i = 0; i < 12; i++) {
            namespace.addVariable({ browseName: `V${i}`, componentOf: node, dataType: DataType.Double });
        }
        return node;
    }
    function lateNodeId(): NodeId {
        counter += 1;
        return new NodeId(NodeId.NodeIdType.STRING, `Late${counter}`, namespace.index);
    }

    it("resolves a target created after the scan that memoized the reference to it", () => {
        const c = busyObject("C1");
        const lateId = lateNodeId();
        c.addReference({ referenceType: "HasComponent", nodeId: lateId });
        const before = c.findReferencesEx("Aggregates");
        const dangling = before.find((ref) => ref.nodeId.toString() === lateId.toString());
        should(dangling).not.be.undefined();
        should(dangling?.node).be.null();

        // the target appears, under another parent, without a word about c: a fresh scan of c
        // would resolve it, and so must the memoized one
        const other = busyObject("Other1");
        const late = namespace.addVariable({ browseName: "Late", nodeId: lateId, dataType: DataType.Double, componentOf: other });
        const after = c.findReferencesEx("Aggregates");
        should(after).equal(before);
        should(after.find((ref) => ref.nodeId.toString() === lateId.toString())?.node).equal(late);
    });

    it("resolves a target that declares the inverse of the memoized reference", () => {
        const c = busyObject("C2");
        const lateId = lateNodeId();
        c.addReference({ referenceType: "HasComponent", nodeId: lateId });
        c.findReferencesEx("Aggregates");
        const other = busyObject("Other2");
        const late = namespace.addVariable({ browseName: "Late", nodeId: lateId, dataType: DataType.Double, componentOf: other });
        late.addReference({ referenceType: "HasComponent", isForward: false, nodeId: c.nodeId });
        const after = c.findReferencesEx("Aggregates").find((ref) => ref.nodeId.toString() === lateId.toString());
        should(after?.node).equal(late);
        should(c.getComponentByName("Late")).equal(late);
    });

    it("lets a type whose component holds such a reference be instantiated", () => {
        const b = namespace.addObjectType({ browseName: "BType" });
        const c = namespace.addObject({ browseName: "C", componentOf: b, modellingRule: "Mandatory" });
        for (let i = 0; i < 12; i++) {
            namespace.addVariable({ browseName: `V${i}`, componentOf: c, dataType: DataType.Double, modellingRule: "Mandatory" });
        }
        const lateId = lateNodeId();
        c.addReference({ referenceType: "HasComponent", nodeId: lateId });
        c.findReferencesEx("Aggregates");
        namespace.addVariable({ browseName: "Late", nodeId: lateId, dataType: DataType.Double, modellingRule: "Mandatory" });

        const t = namespace.addObjectType({ browseName: "TType", subtypeOf: b });
        const instance = t.instantiate({ browseName: "T1", organizedBy: addressSpace.rootFolder.objects });
        const clonedC = instance.getComponentByName("C") as UAObject;
        should(clonedC).not.be.null();
        should(clonedC.getComponentByName("Late")).not.be.null();
    });

    it("lets a deleted node take its non-hierarchical inverse references with it", () => {
        const x = busyObject("X3");
        const lateId = lateNodeId();
        x.addReference({ referenceType: "HasCause", nodeId: lateId });
        x.findReferencesEx("NonHierarchicalReferences", BrowseDirection.Forward);
        const y = namespace.addObjectType({ browseName: "Y3", nodeId: lateId, subtypeOf: "BaseObjectType" });
        y.addReference({ referenceType: "HasCause", isForward: false, nodeId: x.nodeId });
        should(x.findReferencesEx("NonHierarchicalReferences", BrowseDirection.Forward).find((ref) => ref.nodeId.toString() === lateId.toString())?.node).equal(y);
        should(y.findReferencesEx("HasCause", BrowseDirection.Inverse).length).eql(1);

        namespace.deleteNode(x);
        should(y.findReferencesEx("HasCause", BrowseDirection.Inverse).length).eql(0);
    });
});
