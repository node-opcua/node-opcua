/**
 * A child named at runtime gets an own accessor on its parent; a nodeset loaded afterwards may
 * give the same name a shared getter. The own accessor then answers what the getter would, and
 * goes with its child.
 */
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { DataType } from "node-opcua-variant";
import should from "should";
import type { AddressSpace, Namespace, UAObject } from "../dist/api/index.js";
import { hasSharedChildAccessor } from "../dist/impl/child_accessors.js";
import { getMiniAddressSpace } from "../test_helpers/get_mini_address_space.js";

type Dotted = Record<string, unknown>;

describe("an own child accessor", function (this: Mocha.Suite) {
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

    describe("an own child accessor", () => {
        it("does not outlive a shared getter of the same name", async () => {
            const f = namespace.addObject({ browseName: "F8", organizedBy: addressSpace.rootFolder.objects }) as UAObject & Dotted;
            const tag = namespace.addVariable({ browseName: "ZzTag", componentOf: f, dataType: DataType.Double });
            should(f.zzTag).equal(tag);
            should(Object.getOwnPropertyDescriptor(f, "zzTag")?.get).be.a.Function();

            // a nodeset loaded later declares the name: it gets a shared getter
            addressSpace.registerChildAccessorNames(["ZzTag"]);
            should(hasSharedChildAccessor("zzTag")).eql(true);
            should(f.zzTag).equal(tag);

            namespace.deleteNode(tag);
            should(f.zzTag).be.undefined();
            should(Object.getOwnPropertyDescriptor(f, "zzTag")).be.undefined();

            const again = namespace.addVariable({ browseName: "ZzTag", componentOf: f, dataType: DataType.Double });
            should(f.zzTag).equal(again);
        });
    });
});
