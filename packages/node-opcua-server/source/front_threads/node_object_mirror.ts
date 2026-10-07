/**
 * @module node-opcua-server
 *
 * The live values of the engine's node objects (namespace 0: ServerStatus, ServiceLevel, the
 * capabilities, the diagnostics) kept in the shared store, where the fronts and the session
 * workers read every value: in place for a value the store holds, through the engine for a value
 * a getter computes. A Variable whose node object holds its value has it copied into the store,
 * then again at each change; one whose node object computes it (a getter) gets a getter in the
 * store that reads the node object, so that a reader of another thread asks the engine for it.
 */
import type { BaseNode, CompactAddressSpace, IAddressSpace, UAVariable } from "node-opcua-address-space";
import type { StoreVariableView } from "node-opcua-address-space-store";
import { NodeClass } from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";

/** what the node objects keep of a getter (UAVariableImpl, bindVariable) or of a bound structure (bindExtensionObject) */
interface BoundVariable {
    _get_func?: unknown;
    _timestamped_get_func?: unknown;
    refreshFunc?: unknown;
    $extensionObject?: unknown;
}

/** a structure bound to a live object (ServerStatus), or a field of one (ServerStatus.CurrentTime) */
function inBoundStructure(variable: UAVariable): boolean {
    let node: { nodeClass: NodeClass; parent?: unknown } | null = variable;
    while (node && node.nodeClass === NodeClass.Variable) {
        if ((node as BoundVariable).$extensionObject) return true;
        node = (node.parent as { nodeClass: NodeClass; parent?: unknown } | null | undefined) ?? null;
    }
    return false;
}

/** a Variable whose value is computed when read (a getter, a bound structure): the store asks the node object */
function computesItsValue(variable: UAVariable): boolean {
    const bound = variable as unknown as BoundVariable;
    return !!(bound._get_func || bound._timestamped_get_func || bound.refreshFunc) || inBoundStructure(variable);
}

function store(view: StoreVariableView, dataValue: DataValue): boolean {
    try {
        view.setValueFromSource(dataValue.value, dataValue.statusCode, dataValue.sourceTimestamp ?? undefined);
        return true;
    } catch {
        // a value the store's DataType check refuses: the store asks the node object instead
        return false;
    }
}

/**
 * keeps the store in step with the node objects of these namespaces; returns how many Variables
 * it mirrors and what stops it
 */
export function mirrorNodeObjects(
    addressSpace: IAddressSpace,
    compact: CompactAddressSpace,
    namespaces: number[]
): { mirrored: number; stop: () => void } {
    const listeners: { variable: UAVariable; listener: (dataValue: DataValue) => void }[] = [];
    for (const index of namespaces) {
        const namespace = addressSpace.getNamespace(index);
        // collected first: binding a getter must not change a namespace being iterated
        const nodes: BaseNode[] = [...namespace.nodeIterator()];
        for (const node of nodes) {
            if (node.nodeClass !== NodeClass.Variable) continue;
            const view = compact.findNode(node.nodeId) as StoreVariableView | null;
            if (!view || view.nodeClass !== NodeClass.Variable) continue;
            const variable = node as UAVariable;
            if (computesItsValue(variable) || !store(view, variable.readValue())) {
                view.bindVariable({ get: () => variable.readValue().value });
            }
            // not listened to: reading ServerStatus touches its CurrentTime, which reports a change of
            // ServerStatus, which a listener would read again; they are sampled through the engine
            if (inBoundStructure(variable)) continue;
            // a change the node object reports (a write, setValueFromSource) reaches the store and its watchers
            const listener = (dataValue: DataValue) => {
                if (!store(view, dataValue)) {
                    // the value no longer fits the store's DataType: the store asks the node object from now on
                    view.bindVariable({ get: () => variable.readValue().value });
                }
            };
            variable.on("value_changed", listener);
            listeners.push({ variable, listener });
        }
    }
    return {
        mirrored: listeners.length,
        stop: () => {
            for (const { variable, listener } of listeners) variable.removeListener("value_changed", listener);
        }
    };
}
