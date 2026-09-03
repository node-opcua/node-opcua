/**
 * The registries behind the shared child accessors (browse name to accessor name, and the
 * irregular spellings a getter must know) hold the vocabulary of the loaded nodesets: a server
 * that names its nodes per job creates and deletes them for months without growing them.
 */
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { DataType } from "node-opcua-variant";
import should from "should";
import type { AddressSpace, Namespace } from "../dist/api/index.js";
import { childAccessorRegistrySizes, hasSharedChildAccessor } from "../dist/impl/child_accessors.js";
import { getMiniAddressSpace } from "../test_helpers/get_mini_address_space.js";

type Dotted = Record<string, unknown>;

describe("the accessor-name registries", function (this: Mocha.Suite) {
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

    describe("the accessor-name registries", () => {
        it("are bounded by the nodeset vocabulary, whatever the runtime creates and deletes", () => {
            const folder = namespace.addFolder(addressSpace.rootFolder.objects, { browseName: "Churn" });
            const before = childAccessorRegistrySizes();
            for (let cycle = 0; cycle < 4; cycle++) {
                const created = [];
                for (let i = 0; i < 5000; i++) {
                    // a regular name and an irregular one (an underscore, upper-case letters)
                    const browseName = i % 2 === 0 ? `tag_${cycle}_${i}` : `EU_Range_${cycle}_${i}`;
                    created.push(namespace.addVariable({ browseName, componentOf: folder, dataType: DataType.Double }));
                }
                should((folder as unknown as Dotted)[`tag_${cycle}_0`]).equal(created[0]);
                for (const node of created) {
                    namespace.deleteNode(node);
                }
                should(childAccessorRegistrySizes()).eql(before);
            }
            namespace.deleteNode(folder);
        });

        it("still map an irregular runtime name to the shared getter that serves it", () => {
            addressSpace.registerChildAccessorNames(["EURange"]);
            should(hasSharedChildAccessor("euRange")).eql(true);
            const holder = namespace.addObject({ browseName: "Holder", organizedBy: addressSpace.rootFolder.objects });
            const range = namespace.addVariable({ browseName: "EURange", propertyOf: holder, dataType: DataType.Double });
            should((holder as unknown as Dotted).euRange).equal(range);
        });
    });
});
