/**
 * @module node-opcua-server
 *
 * A node object of the engine (namespace 0: ServerStatus, the diagnostics...) as a monitored item
 * in a session worker sees it. It is described when the item is created, by a Read the engine runs
 * in the context of the session; a sampled item reads its value through the engine; an item that
 * reports changes as they happen makes the worker watch it, and the engine pushes the values
 * written to it.
 */
import { AttributeIds, QualifiedName } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { StatusCodes } from "node-opcua-status-code";
import { MonitoredNodeBase } from "./front_node_base.js";
// the built-in numeric DataTypes (SByte to Double), what a deadband applies to
const NUMBER_TYPES = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
export class RemoteObjectNode extends MonitoredNodeBase {
    minimumSamplingInterval;
    #host;
    #last = null;
    constructor(host, nodeId, description) {
        super(host, nodeId, description.nodeClass, description.browseName, description.dataType ?? undefined);
        this.#host = host;
        this.minimumSamplingInterval = description.minimumSamplingInterval;
    }
    startWatching() {
        this.#host.watch(this);
    }
    stopWatching() {
        this.#host.unwatch(this);
    }
    isNumberDataType() {
        return !!this.dataType && this.dataType.namespace === 0 && NUMBER_TYPES.has(this.dataType.value);
    }
    getChildByName() {
        return null;
    }
    readAttribute(_context, attributeId) {
        if (attributeId === AttributeIds.Value) {
            return this.#last ?? new DataValue({ statusCode: StatusCodes.BadWaitingForInitialData });
        }
        return this.describedAttribute(attributeId) ?? new DataValue({ statusCode: StatusCodes.BadAttributeIdInvalid });
    }
    readValueAsync(context, callback) {
        this.#host.readValue(context, this).then((dataValue) => {
            this.#last = dataValue;
            callback(null, dataValue);
        }, (err) => callback(err));
    }
    /** a value the engine pushed: written to the node object */
    changed(dataValue) {
        this.#last = dataValue;
        this.emit("value_changed", dataValue);
    }
}
/** the description of a node from the Read of its NodeClass, BrowseName, DataType and MinimumSamplingInterval */
export function describeFromRead(values) {
    const [nodeClass, browseName, dataType, minimumSamplingInterval] = values;
    if (!nodeClass?.statusCode.isGood())
        return null;
    return {
        nodeClass: nodeClass.value.value,
        browseName: browseName?.value?.value ?? new QualifiedName({ name: "" }),
        dataType: dataType?.statusCode.isGood() ? dataType.value.value : null,
        minimumSamplingInterval: minimumSamplingInterval?.statusCode.isGood() ? minimumSamplingInterval.value.value : 0
    };
}
/** the attributes describeFromRead() takes, in this order */
export const DESCRIBED_ATTRIBUTES = [
    AttributeIds.NodeClass,
    AttributeIds.BrowseName,
    AttributeIds.DataType,
    AttributeIds.MinimumSamplingInterval
];
//# sourceMappingURL=remote_object_node.js.map