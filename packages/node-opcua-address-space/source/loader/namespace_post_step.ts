import { NodeClass } from "node-opcua-data-model";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";

import { UAObject, UAVariable, IAddressSpace, INamespace } from "node-opcua-address-space-base";
import { NamespacePrivate } from "../../src/namespace_private";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

export const g_promotableObject: { [key: string]: (node: any) => any } = {};

export async function promoteObjectAndVariablesInNamespace(namespace: INamespace): Promise<void> {
    const namespaceP = namespace as NamespacePrivate;
    for (const a of namespaceP.nodeIterator()) {
        if (a.nodeClass === NodeClass.Object || a.nodeClass === NodeClass.Variable) {
            const aa = a as UAObject | UAVariable;
            if (aa.typeDefinition) {
                const promoter = g_promotableObject[aa.typeDefinition.toString()];
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
export async function promoteObjectsAndVariables(addressSpace: IAddressSpace): Promise<void> {
    for (const namespace of addressSpace.getNamespaceArray()) {
        promoteObjectAndVariablesInNamespace(namespace);
    }
}
