/**
 * The isSubtypeOf memo of a type is keyed by the NodeId of the type asked about, not by the node:
 * a type created and deleted at runtime must not stay reachable through the memos of the types
 * it was compared with.
 */
import v8 from "node:v8";
import vm from "node:vm";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import type { AddressSpace, Namespace, UAObjectType } from "../dist/api/index.js";
import { getMiniAddressSpace } from "../test_helpers/get_mini_address_space.js";

/** a garbage collection, whether or not the process was started with --expose-gc */
function collectGarbage(): () => void {
    if (typeof globalThis.gc === "function") {
        return globalThis.gc as () => void;
    }
    v8.setFlagsFromString("--expose-gc");
    return vm.runInNewContext("gc") as () => void;
}

describe("the isSubtypeOf memo", function (this: Mocha.Suite) {
    this.timeout(120000);

    let addressSpace: AddressSpace;
    let namespace: Namespace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
    });
    after(() => {
        addressSpace.dispose();
    });

    describe("the isSubtypeOf memo", () => {
        it("does not keep a deleted type alive, asked about in either direction", async () => {
            const gc = collectGarbage();
            const folderType = addressSpace.findObjectType("FolderType") as UAObjectType;
            const baseObjectType = addressSpace.findObjectType("BaseObjectType") as UAObjectType;
            const refs: WeakRef<UAObjectType>[] = [];
            for (let i = 0; i < 2000; i++) {
                const t = namespace.addObjectType({ browseName: `T${i}` });
                should(folderType.isSubtypeOf(t)).eql(false);
                should(t.isSubtypeOf(baseObjectType)).eql(true);
                refs.push(new WeakRef(t));
                namespace.deleteNode(t);
            }
            gc();
            await new Promise((resolve) => setImmediate(resolve));
            gc();
            const alive = refs.filter((ref) => ref.deref() !== undefined).length;
            should(alive).be.lessThan(10);
        });
    });
});
