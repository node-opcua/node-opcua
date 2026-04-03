/**
 * Enumeration type and variable for conformance testing.
 */
import type { Namespace, UAObject } from "node-opcua-address-space";

export function addEnumerationVariable(namespaceDemo: Namespace, parentFolder: UAObject): void {
    const addressSpace = namespaceDemo.addressSpace;

    const myEnumType = namespaceDemo.addEnumerationType({
        browseName: "SimulationEnumerationType",
        enumeration: [
            { value: 1, displayName: "RUNNING" },
            { value: 2, displayName: "BLOCKED" },
            { value: 3, displayName: "IDLE" },
            { value: 4, displayName: "UNDER MAINTENANCE" }
        ]
    });

    const e = namespaceDemo.addVariable({
        organizedBy: parentFolder,
        propertyOf: (addressSpace.rootFolder.objects.server as unknown as Record<string, unknown>)
            .vendorServerInfos as unknown as UAObject,
        dataType: myEnumType,
        browseName: "RunningState"
    });
    e.writeEnumValue("RUNNING");
}
