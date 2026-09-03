/**
 * The answers of isSubtypeOf follow a type that is re-parented at runtime, on every type below it.
 */
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import type { AddressSpace, Namespace, UAObjectType } from "../dist/api/index.js";
import { getMiniAddressSpace } from "../test_helpers/get_mini_address_space.js";

describe("the isSubtypeOf memo after a re-parenting", function (this: Mocha.Suite) {
    this.timeout(60000);

    let addressSpace: AddressSpace;
    let namespace: Namespace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
    });
    after(() => {
        addressSpace.dispose();
    });

    it("answers isSubtypeOf afresh for the types below a type that is re-parented", () => {
        const c = namespace.addObjectType({ browseName: "C15" });
        const b = namespace.addObjectType({ browseName: "B15", subtypeOf: c });
        const a = namespace.addObjectType({ browseName: "A15", subtypeOf: b });
        const d = namespace.addObjectType({ browseName: "D15" });
        should(a.isSubtypeOf(c)).eql(true);
        should(a.isSubtypeOf(d)).eql(false);

        // B moves from under C to under D; A never changed a reference of its own
        b.removeReference({ referenceType: "HasSubtype", isForward: false, nodeId: c.nodeId });
        b.addReference({ referenceType: "HasSubtype", isForward: false, nodeId: d.nodeId });
        should((b as UAObjectType).subtypeOfObj).equal(d);
        should(a.isSubtypeOf(d)).eql(true);
        should(a.isSubtypeOf(c)).eql(false);
    });
});
