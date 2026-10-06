import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import { AddressSpace, type Namespace, type UAObject } from "../dist/api/index.js";
import { maxOwnChildAccessorsPerParent } from "../dist/impl/base_node_impl.js";
import { generateAddressSpace } from "../nodeJS.js";
import { get_mini_nodeset_filename } from "../testHelpers.js";

// a node created at runtime is exposed as `parent.<name>` through an accessor installed on the
// parent, one per child. A parent with more runtime children than anyone addresses by hand
// stops getting them: the children stay reachable through getChildByName and browse
describe("child accessors on a parent with very many runtime children", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [get_mini_nodeset_filename()]);
        namespace = addressSpace.registerNamespace("urn:cap");
    });
    after(() => {
        addressSpace.dispose();
    });

    const tags = (parent: UAObject, count: number, prefix: string) => {
        for (let i = 0; i < count; i++) {
            namespace.addVariable({ componentOf: parent, browseName: `${prefix}${i}`, dataType: "Double" });
        }
    };

    it("exposes the first thousand children as properties, the rest by name only", () => {
        const folder = namespace.addObject({ organizedBy: addressSpace.rootFolder.objects, browseName: "Tags" });
        tags(folder, maxOwnChildAccessorsPerParent + 5, "Tag");
        const asRecord = folder as unknown as Record<string, unknown>;

        should(asRecord.tag0).equal(folder.getChildByName("Tag0"));
        should(asRecord[`tag${maxOwnChildAccessorsPerParent - 1}`]).equal(
            folder.getChildByName(`Tag${maxOwnChildAccessorsPerParent - 1}`)
        );
        should(asRecord[`tag${maxOwnChildAccessorsPerParent}`]).eql(undefined);
        should(folder.getChildByName(`Tag${maxOwnChildAccessorsPerParent + 4}`)?.browseName.name).eql(
            `Tag${maxOwnChildAccessorsPerParent + 4}`
        );
        should(folder.getComponents().length).eql(maxOwnChildAccessorsPerParent + 5);
    });

    it("frees a slot when a child goes, so a later child gets a property again", () => {
        const folder = namespace.addObject({ organizedBy: addressSpace.rootFolder.objects, browseName: "Pool" });
        tags(folder, maxOwnChildAccessorsPerParent, "Item");
        const asRecord = folder as unknown as Record<string, unknown>;

        const late = namespace.addVariable({ componentOf: folder, browseName: "Late", dataType: "Double" });
        should(asRecord.late).eql(undefined, "the parent is full");

        namespace.deleteNode(folder.getChildByName("Item0") as UAObject);
        const later = namespace.addVariable({ componentOf: folder, browseName: "Later", dataType: "Double" });
        should(asRecord.later).equal(later);
        should(asRecord.late).eql(undefined, "a child that missed its accessor does not get one later");
        should(folder.getChildByName("Late")).equal(late);
    });

    it("a small parent is unaffected", () => {
        const device = namespace.addObject({ organizedBy: addressSpace.rootFolder.objects, browseName: "Device" });
        tags(device, 3, "Sensor");
        const asRecord = device as unknown as Record<string, unknown>;
        should(asRecord.sensor2).equal(device.getChildByName("Sensor2"));
    });
});
