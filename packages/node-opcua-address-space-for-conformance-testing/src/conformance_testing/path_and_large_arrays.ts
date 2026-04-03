/**
 * 10-deep path and very large array variables for conformance testing.
 */
import type { Namespace, UAObject } from "node-opcua-address-space";

import { addArrayVariable } from "./helpers";
import { typeAndDefaultValue } from "./type_defaults";

export function addPath10Deep(namespace: Namespace, simulation_folder: UAObject) {
    let parent = simulation_folder;
    for (let i = 1; i <= 10; i++) {
        const name = `Path_${i.toString()}Deep`;
        const child = namespace.addObject({
            organizedBy: parent,
            browseName: name,
            description: `A folder at the top of ${i} elements`,
            typeDefinition: "FolderType",
            nodeId: `s=${name}`
        });
        parent = child;
    }
}

export function addVeryLargeArrayVariables(namespace: Namespace, objectsFolder: UAObject): void {
    const scalarStaticLargeArray = namespace.addObject({
        organizedBy: objectsFolder,
        browseName: "Static_Scalar_Large_Array",
        description: "Single dimension, suggested size of 100k-elements per array.",
        nodeId: "s=Static_Scalar_Large_Array"
    });
    for (const e of typeAndDefaultValue) {
        const realType = e.realType || e.type;
        addArrayVariable(namespace, scalarStaticLargeArray, e.type, e.defaultValue, realType, 50 * 1024, "");
    }
}
