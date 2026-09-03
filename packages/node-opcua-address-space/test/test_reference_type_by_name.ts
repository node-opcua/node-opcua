/**
 * A reference type named by its browse name keeps the direction the caller gave, even when its
 * inverse name is that same string.
 */
import { BrowseDirection } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import type { AddressSpace, Namespace } from "../dist/api/index.js";
import { getMiniAddressSpace } from "../test_helpers/get_mini_address_space.js";

describe("a reference type named by its browse name", function (this: Mocha.Suite) {
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

    it("keeps the direction given when a reference type's inverse name is its browse name", () => {
        // the mini nodeset declares <InverseName>GeneratesEvent</InverseName> on GeneratesEvent
        const generatesEvent = addressSpace.findReferenceType("GeneratesEvent");
        should(generatesEvent?.inverseName.text).eql("GeneratesEvent");
        const source = namespace.addObject({ browseName: "Source", organizedBy: addressSpace.rootFolder.objects });
        const eventType = namespace.addObjectType({ browseName: "SourceEventType", subtypeOf: "BaseEventType" });
        source.addReference({ referenceType: "GeneratesEvent", nodeId: eventType.nodeId });
        should(source.findReferencesEx("GeneratesEvent", BrowseDirection.Forward).map((r) => r.node)).containEql(eventType);
        should(source.findReferencesEx("GeneratesEvent", BrowseDirection.Inverse)).have.length(0);
        // a real inverse name still flips
        const folder = namespace.addObject({ browseName: "Folder15" });
        folder.addReference({ referenceType: "OrganizedBy", nodeId: addressSpace.rootFolder.objects.nodeId });
        should(folder.findReferencesEx("Organizes", BrowseDirection.Inverse)).have.length(1);
    });
});
