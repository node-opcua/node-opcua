/**
 * Access-right test variables for conformance testing.
 */
import type { Namespace, UAObject } from "node-opcua-address-space";
import { makeAccessLevelFlag } from "node-opcua-data-model";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";

const defaultInt32Value = new Variant({
    dataType: DataType.Int32,
    arrayType: VariantArrayType.Scalar,
    value: 36
});

const accessRightConfigs: {
    name: string;
    accessLevel: string;
    userAccessLevel: string;
    value?: Record<string, unknown>;
}[] = [
    { name: "AccessLevel_CurrentRead", accessLevel: "CurrentRead", userAccessLevel: "CurrentRead" },
    { name: "AccessLevel_CurrentWrite", accessLevel: "CurrentWrite", userAccessLevel: "CurrentWrite", value: {} },
    { name: "AccessLevel_CurrentRead_NotUser", accessLevel: "CurrentRead", userAccessLevel: "" },
    { name: "AccessLevel_CurrentWrite_NotUser", accessLevel: "CurrentWrite | CurrentRead", userAccessLevel: "CurrentRead" },
    { name: "AccessLevel_CurrentRead_NotCurrentWrite", accessLevel: "CurrentRead", userAccessLevel: "CurrentRead" },
    { name: "AccessLevel_CurrentWrite_NotCurrentRead", accessLevel: "CurrentWrite", userAccessLevel: "CurrentWrite" },
    { name: "AccessLevel_DeniedAll", accessLevel: "", userAccessLevel: "" }
];

export function addAccessRightVariables(namespace: Namespace, parentFolder: UAObject): void {
    const accessRight_Folder = namespace.addFolder(parentFolder, {
        browseName: "AccessRight",
        description: "Folder containing various nodes with different access right behavior",
        nodeId: "s=AccessRight"
    });

    const accessLevel_All_Folder = namespace.addFolder(accessRight_Folder, {
        browseName: "AccessLevel",
        description: "Various node with different access right behavior",
        nodeId: "s=AccessLevel"
    });

    for (const config of accessRightConfigs) {
        namespace.addVariable({
            componentOf: accessLevel_All_Folder,
            browseName: config.name,
            description: { locale: "en", text: config.name },
            nodeId: `s=${config.name}`,
            dataType: "Int32",
            valueRank: -1,
            accessLevel: makeAccessLevelFlag(config.accessLevel),
            userAccessLevel: makeAccessLevelFlag(config.userAccessLevel),
            value: config.value ?? defaultInt32Value
        });
    }
}
