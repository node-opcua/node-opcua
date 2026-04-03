/**
 * Mass variables: 100 items per supported data-type.
 */
import type { Namespace, UAObject } from "node-opcua-address-space";

import { addVariable } from "./helpers";
import { typeAndDefaultValue } from "./type_defaults";

function addMassVariablesOfType(
    namespace: Namespace,
    parent: UAObject,
    dataTypeName: string,
    default_value: unknown,
    realType: string
): void {
    const nodeName = `Scalar_Mass_${dataTypeName}`;

    const scalarMass_Type = namespace.addObject({
        browseName: nodeName,
        description: "This folder will contain 100 items per supported data-type.",
        nodeId: `s=${nodeName}`,
        organizedBy: parent
    });
    for (let i = 0; i <= 99; i++) {
        const extra_name = `_${i.toString().padStart(2, "0")}`;
        const local_defaultValue = typeof default_value === "function" ? default_value() : default_value;
        addVariable(namespace, scalarMass_Type, dataTypeName, realType, local_defaultValue, -1, null, extra_name);
    }
}

export function addMassVariables(namespace: Namespace, scalarFolder: UAObject): void {
    const scalarMass = namespace.addFolder(scalarFolder, {
        browseName: "Scalar_Mass",
        description: "This folder will contain 100 items per supported data-type.",
        nodeId: "s=Scalar_Mass"
    });

    for (const e of typeAndDefaultValue) {
        const realType = e.realType || e.type;
        addMassVariablesOfType(namespace, scalarMass, e.type, e.defaultValue, realType);
    }
}
