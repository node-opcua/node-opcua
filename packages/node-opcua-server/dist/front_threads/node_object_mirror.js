import { NodeClass } from "node-opcua-data-model";
/** a structure bound to a live object (ServerStatus), or a field of one (ServerStatus.CurrentTime) */
function inBoundStructure(variable) {
    let node = variable;
    while (node && node.nodeClass === NodeClass.Variable) {
        if (node.$extensionObject)
            return true;
        node = node.parent ?? null;
    }
    return false;
}
/** a Variable whose value is computed when read (a getter, a bound structure): the store asks the node object */
function computesItsValue(variable) {
    const bound = variable;
    return !!(bound._get_func || bound._timestamped_get_func || bound.refreshFunc) || inBoundStructure(variable);
}
function store(view, dataValue) {
    try {
        view.setValueFromSource(dataValue.value, dataValue.statusCode, dataValue.sourceTimestamp ?? undefined);
        return true;
    }
    catch {
        // a value the store's DataType check refuses: the store asks the node object instead
        return false;
    }
}
/**
 * keeps the store in step with the node objects of these namespaces; returns how many Variables
 * it mirrors and what stops it
 */
export function mirrorNodeObjects(addressSpace, compact, namespaces) {
    const listeners = [];
    for (const index of namespaces) {
        const namespace = addressSpace.getNamespace(index);
        // collected first: binding a getter must not change a namespace being iterated
        const nodes = [...namespace.nodeIterator()];
        for (const node of nodes) {
            if (node.nodeClass !== NodeClass.Variable)
                continue;
            const view = compact.findNode(node.nodeId);
            if (!view || view.nodeClass !== NodeClass.Variable)
                continue;
            const variable = node;
            if (computesItsValue(variable) || !store(view, variable.readValue())) {
                view.bindVariable({ get: () => variable.readValue().value });
            }
            // not listened to: reading ServerStatus touches its CurrentTime, which reports a change of
            // ServerStatus, which a listener would read again; they are sampled through the engine
            if (inBoundStructure(variable))
                continue;
            // a change the node object reports (a write, setValueFromSource) reaches the store and its watchers
            const listener = (dataValue) => {
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
            for (const { variable, listener } of listeners)
                variable.removeListener("value_changed", listener);
        }
    };
}
//# sourceMappingURL=node_object_mirror.js.map