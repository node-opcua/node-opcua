import { NodeClass } from "node-opcua-data-model";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";

import { UAObject } from "../../src/ua_object";
import { UAVariable } from "../../src/ua_variable";
import { AddressSpace } from "../address_space_ts";
import { UANamespace } from "./../../src/namespace";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

export const g_promotableObject: { [key: string]: (node: any) => any } = {};

export async function promoteObjectAndVariablesInNamespace(namespace: UANamespace) {
    for (const a of namespace.nodeIterator()) {
        if (a.nodeClass === NodeClass.Object || a.nodeClass === NodeClass.Variable) {
            if (a.typeDefinition) {
                const promoter = g_promotableObject[a.typeDefinition.toString()];
                if (promoter) {
                    const before = a.constructor.name;
                    promoter(a as UAObject | UAVariable);
                    const after = a.constructor.name;
                    if (doDebug) {
                        debugLog(`promoting ${a.browseName.toString()} from ${before} to ${after}`);
                    }
                }
            }
        }
    }
}
export async function promoteObjectsAndVariables(addressSpace: AddressSpace) {
    for (const namespace of addressSpace.getNamespaceArray()) {
        promoteObjectAndVariablesInNamespace(namespace as UANamespace);
    }
}
