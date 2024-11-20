import { NodeClass } from "node-opcua-data-model";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";

import { UAObject, UAVariable, IAddressSpace, INamespace, UAVariableType } from "node-opcua-address-space-base";
import { NamespacePrivate } from "../../src/namespace_private";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

export type Promoter = ((node: UAVariable) => UAVariable) | ((node: UAObject) => UAObject);

export const g_promotableObject: Map<
    string,
    {
        promoter: Promoter;
        onInstanceOnly: boolean;
    }
> = new Map();

function parentIsObjectOrVariableType(node: UAVariable | UAObject): boolean {
    if (node.parent && (node.parent.nodeClass === NodeClass.VariableType || node.parent?.nodeClass === NodeClass.ObjectType)) {
        return true;
    }
    if (!node.parent) {
        return false;
    }
    return parentIsObjectOrVariableType(node.parent as UAVariable | UAObject);
}

export async function promoteObjectAndVariablesInNamespace(namespace: INamespace): Promise<void> {
    const namespaceP = namespace as NamespacePrivate;
    for (const a of namespaceP.nodeIterator()) {
        if (a.nodeClass === NodeClass.Object || a.nodeClass === NodeClass.Variable) {
            // skip object & variable that belong to a ObjectType or VariableType
            const aa = a as UAObject | UAVariable;

            if (aa.typeDefinition) {
                const promoter = g_promotableObject.get(aa.typeDefinition.toString());
                if (promoter) {
                    if (promoter.onInstanceOnly && parentIsObjectOrVariableType(aa)) {
                        continue;
                    }
                    const before = a.constructor.name;

                    promoter.promoter(a as any);
                    const after = a.constructor.name;
                    // istanbul ignore next
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
