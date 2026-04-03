/**
 * Sample views for conformance testing.
 */
import type { Namespace } from "node-opcua-address-space";

export function addSampleView(namespace: Namespace): void {
    const addressSpace = namespace.addressSpace;

    const view1 = namespace.addView({
        organizedBy: addressSpace.rootFolder.views,
        browseName: "SampleView",
        nodeId: "s=SampleView"
    });
    view1.addReference({
        nodeId: "i=2256", // Server_Status
        referenceType: "Organizes"
    });
    view1.addReference({
        nodeId: "i=11715", // Server_Namespaces
        referenceType: "Organizes"
    });

    namespace.addView({
        organizedBy: addressSpace.rootFolder.views,
        browseName: "OtherSampleView",
        nodeId: "s=OtherSampleView"
    });
}
