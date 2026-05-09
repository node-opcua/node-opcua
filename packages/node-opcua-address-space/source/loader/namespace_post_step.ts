import type { IAddressSpace, INamespace, UAObject, UAVariable } from "node-opcua-address-space-base";
import { NodeClass } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import type { NamespacePrivate } from "../../src/namespace_private";

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

    const promoteNode = (a: UAObject | UAVariable) => {
        if (a.typeDefinition) {
            const promoter = g_promotableObject.get(a.typeDefinition.toString());
            if (promoter) {
                if (promoter.onInstanceOnly && parentIsObjectOrVariableType(a)) {
                    return;
                }
                const before = a.constructor.name;

                promoter.promoter(a as any);
                const after = a.constructor.name;
                // c8 ignore next
                if (doDebug) {
                    debugLog(`promoting ${a.browseName.toString()} from ${before} to ${after}`);
                }
            }
        }
    };

    // Promote variables first so that TwoStateVariables and other variable types
    // are fully promoted before objects (like StateMachines or Alarms) that contain them.
    for (const a of namespaceP.nodeIterator()) {
        if (a.nodeClass === NodeClass.Variable) {
            promoteNode(a as UAVariable);
        }
    }
    for (const a of namespaceP.nodeIterator()) {
        if (a.nodeClass === NodeClass.Object) {
            promoteNode(a as UAObject);
        }
    }
}
export async function promoteObjectsAndVariables(addressSpace: IAddressSpace): Promise<void> {
    for (const namespace of addressSpace.getNamespaceArray()) {
        promoteObjectAndVariablesInNamespace(namespace);
    }
}
