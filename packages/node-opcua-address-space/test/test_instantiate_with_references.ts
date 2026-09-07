import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, getSymbols, setSymbols, type UAObjectType, type UAVariableType } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

/**
 * instantiate() with `options.references`
 *
 * A child linked to its parent through an aggregate reference that has no
 * dedicated option (HasOrderedComponent ...) must get that link at
 * construction, so that:
 *   - the NodeIdManager names it after its parent (`ListType_First`),
 *   - modelling rules are copied when the parent lives inside a type.
 * Before, instantiate() discarded a caller-supplied `references` array.
 */
describe("UAObjectType/UAVariableType instantiate with options.references", () => {
    let addressSpace: AddressSpace;
    let listType: UAObjectType;
    let itemType: UAObjectType;
    let sampleType: UAVariableType;

    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("Private");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        const ns = addressSpace.getOwnNamespace();
        setSymbols(ns, []);

        listType = ns.addObjectType({ browseName: "ListType" });
        itemType = ns.addObjectType({ browseName: "ItemType" });
        ns.addVariable({
            browseName: "Level",
            dataType: "Double",
            modellingRule: "Mandatory",
            propertyOf: itemType
        });
        sampleType = ns.addVariableType({ browseName: "SampleType", dataType: "Double" });
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    it("UAObjectType.instantiate creates the HasOrderedComponent link and names the node after its parent", () => {
        const first = itemType.instantiate({
            browseName: "First",
            modellingRule: "Mandatory",
            references: [{ referenceType: "HasOrderedComponent", isForward: false, nodeId: listType.nodeId }]
        });

        const ordered = listType.findReferencesEx("HasOrderedComponent");
        ordered.length.should.eql(1);
        ordered[0].nodeId.toString().should.eql(first.nodeId.toString());
        first.parentNodeId?.toString().should.eql(listType.nodeId.toString());

        // the mandatory property was instantiated with its modelling rule copied
        const level = first.getPropertyByName("Level");
        should.exist(level);
        level!.modellingRule!.should.eql("Mandatory");

        const symbols = getSymbols(addressSpace.getOwnNamespace());
        const names = symbols.map((s) => s[0]);
        names.should.containEql("ListType_First");
        names.should.containEql("ListType_First_Level");
        names.should.not.containEql("First");
    });

    it("UAVariableType.instantiate creates the HasOrderedComponent link and names the node after its parent", () => {
        const first = sampleType.instantiate({
            browseName: "FirstSample",
            dataType: "Double",
            modellingRule: "Optional",
            references: [{ referenceType: "HasOrderedComponent", isForward: false, nodeId: listType.nodeId }]
        });

        const ordered = listType.findReferencesEx("HasOrderedComponent");
        ordered.length.should.eql(1);
        ordered[0].nodeId.toString().should.eql(first.nodeId.toString());
        first.parentNodeId?.toString().should.eql(listType.nodeId.toString());

        const names = getSymbols(addressSpace.getOwnNamespace()).map((s) => s[0]);
        names.should.containEql("ListType_FirstSample");
        names.should.not.containEql("FirstSample");
    });

    it("a duplicate browseName under the ordered parent is rejected", () => {
        itemType.instantiate({
            browseName: "First",
            references: [{ referenceType: "HasOrderedComponent", isForward: false, nodeId: listType.nodeId }]
        });
        // the second node resolves to the same symbolic name, hence the same
        // NodeId, and the namespace refuses to register it twice
        should.throws(() => {
            itemType.instantiate({
                browseName: "First",
                references: [{ referenceType: "HasOrderedComponent", isForward: false, nodeId: listType.nodeId }]
            });
        }, /already registered|already a child with browseName/);
    });

    it("instantiate without references behaves as before (componentOf)", () => {
        const holder = addressSpace
            .getOwnNamespace()
            .addObject({ browseName: "Holder", organizedBy: addressSpace.rootFolder.objects });
        const first = itemType.instantiate({ browseName: "First", componentOf: holder });
        first.parentNodeId?.toString().should.eql(holder.nodeId.toString());
        const names = getSymbols(addressSpace.getOwnNamespace()).map((s) => s[0]);
        names.should.containEql("Holder_First");
    });
});
