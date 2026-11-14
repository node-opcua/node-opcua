/**
 * @module node-opcua-server
 *
 * What the nodes a monitored item sees in another thread than the engine's have in common, a node of
 * the shared store (FrontMonitoredNode) or a node object of the engine (RemoteObjectNode): what the
 * engine described of them, the watch a listener to value_changed starts, and their events, filtered
 * by the engine.
 */
import { EventEmitter } from "node:events";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
export class MonitoredNodeBase extends EventEmitter {
    nodeId;
    nodeClass;
    browseName;
    dataType;
    #events;
    #watching = false;
    constructor(events, nodeId, nodeClass, browseName, dataType) {
        super();
        this.#events = events;
        this.nodeId = nodeId;
        this.nodeClass = nodeClass;
        this.browseName = browseName;
        this.dataType = dataType;
        // an item reporting changes listens to value_changed: the engine then pushes the node's values
        this.on("newListener", (event) => {
            if (event === "value_changed" && !this.#watching && this.canWatch()) {
                this.#watching = true;
                this.startWatching();
            }
        });
        this.on("removeListener", (event) => {
            if (event === "value_changed" && this.#watching && this.listenerCount("value_changed") === 0) {
                this.#watching = false;
                this.stopWatching();
            }
        });
    }
    canWatch() {
        return true;
    }
    subscribeEvents(filter, context, onFields, item) {
        return this.#events.subscribeEvents(this.nodeId, filter, context, onFields, item);
    }
    analyzeEventFilter(filter) {
        return this.#events.eventFilterResult(filter);
    }
    /** NodeId, NodeClass, BrowseName, DataType: what the engine described; undefined for the other attributes */
    describedAttribute(attributeId) {
        switch (attributeId) {
            case AttributeIds.NodeId:
                return new DataValue({ statusCode: StatusCodes.Good, value: { dataType: DataType.NodeId, value: this.nodeId } });
            case AttributeIds.NodeClass:
                return new DataValue({ statusCode: StatusCodes.Good, value: { dataType: DataType.Int32, value: this.nodeClass } });
            case AttributeIds.BrowseName:
                return new DataValue({
                    statusCode: StatusCodes.Good,
                    value: { dataType: DataType.QualifiedName, value: this.browseName }
                });
            case AttributeIds.DataType:
                return this.dataType
                    ? new DataValue({ statusCode: StatusCodes.Good, value: { dataType: DataType.NodeId, value: this.dataType } })
                    : new DataValue({ statusCode: StatusCodes.BadAttributeIdInvalid });
            default:
                return undefined;
        }
    }
}
//# sourceMappingURL=front_node_base.js.map