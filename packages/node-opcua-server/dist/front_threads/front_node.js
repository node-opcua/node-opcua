/**
 * @module node-opcua-server
 *
 * A node of the compact namespaces as a monitored item in a front thread sees it. What does not
 * depend on the session (class, name, DataType) was described by the engine when the item was
 * created; the value is read in place when no permission rule applies to it, else asked to the
 * engine. A listener to value_changed makes the front watch the node: the engine, the only
 * writer, then pushes every value written to it. A pushed value goes to the item as it is only
 * when every session may read it; otherwise the item's session reads it again through the engine,
 * which applies its roles. A version word orders the values whatever path they came by, so that
 * an item never goes back to an older value.
 *
 * A percent deadband reads the EURange property: the front watches it from the first use, so
 * that a new range applies to the next value.
 */
var _a;
import { AttributeIds, NodeClass, QualifiedName } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { resolveNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { Range } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import { MonitoredNodeBase } from "./front_node_base.js";
function good(value) {
    return new DataValue({ statusCode: StatusCodes.Good, value });
}
function bad(statusCode) {
    return new DataValue({ statusCode });
}
export class FrontMonitoredNode extends MonitoredNodeBase {
    index;
    generation;
    #host;
    #isNumber;
    // a node watched for the front itself (the EURange of a deadband): its values need no session
    #trusted;
    #euRange;
    #euRangeNode;
    #rangeWatch = null;
    // the session of the item, from its reads: what a value pushed under a permission rule is read again with
    #context = undefined;
    #refetching = false;
    #refetchAgain = false;
    // the newest value seen and its version word; -1: none yet
    #version = -1;
    #last = null;
    #disposed = false;
    constructor(host, nodeId, description, trusted = false) {
        super(host, nodeId, description.nodeClass, new QualifiedName({ namespaceIndex: description.namespaceIndex, name: description.name }), description.dataType ? resolveNodeId(description.dataType) : undefined);
        this.#host = host;
        this.#trusted = trusted;
        this.index = description.index;
        this.generation = description.generation;
        this.#euRange = description.euRange;
        this.#euRangeNode = description.euRangeNode;
        this.#isNumber = description.isNumber;
        this.on("removeListener", (event) => {
            // every monitored item listens to "dispose" until it ends
            if (event === "dispose" && this.listenerCount("dispose") === 0) {
                this.#stopWatchingRange();
            }
        });
    }
    startWatching() {
        this.#host.watch(this);
    }
    stopWatching() {
        this.#host.unwatch(this);
    }
    canWatch() {
        return !this.#disposed;
    }
    get minimumSamplingInterval() {
        return this.#host.minimumSamplingInterval(this);
    }
    isNumberDataType() {
        return this.#isNumber;
    }
    /** only the EURange property, for a percent deadband: its current value, watched from its first read */
    getChildByName(name) {
        if (name !== "EURange" || !this.#euRange) {
            return null;
        }
        return {
            nodeClass: NodeClass.Variable,
            browseName: new QualifiedName({ name: "EURange" }),
            readValue: () => {
                this.#watchRange();
                const [low, high] = this.#euRange ?? [0, 0];
                return good({ dataType: DataType.ExtensionObject, value: new Range({ low, high }) });
            }
        };
    }
    #watchRange() {
        const property = this.#euRangeNode;
        if (this.#rangeWatch || !property || this.#disposed)
            return;
        const watch = new _a(this.#host, resolveNodeId(property.nodeId), {
            index: property.index,
            generation: property.generation,
            nodeClass: NodeClass.Variable,
            namespaceIndex: 0,
            name: "EURange",
            dataType: null,
            isNumber: false,
            euRange: null,
            euRangeNode: null
        }, true);
        watch.on("value_changed", this.#onRange);
        this.#rangeWatch = watch;
    }
    #stopWatchingRange() {
        this.#rangeWatch?.removeListener("value_changed", this.#onRange);
        this.#rangeWatch = null;
    }
    #onRange = (dataValue) => {
        const range = dataValue.value?.value;
        if (range && typeof range.low === "number" && typeof range.high === "number") {
            this.#euRange = [range.low, range.high];
        }
    };
    readAttribute(context, attributeId) {
        this.#context = context;
        const described = this.describedAttribute(attributeId);
        if (described)
            return described;
        switch (attributeId) {
            case AttributeIds.MinimumSamplingInterval:
                return this.nodeClass === NodeClass.Variable
                    ? good({ dataType: DataType.Double, value: this.minimumSamplingInterval })
                    : bad(StatusCodes.BadAttributeIdInvalid);
            case AttributeIds.Value: {
                if (this.nodeClass !== NodeClass.Variable) {
                    return bad(StatusCodes.BadAttributeIdInvalid);
                }
                const inPlace = this.#host.valueInPlace(this);
                if (inPlace) {
                    this.#note(inPlace.dataValue, inPlace.version);
                    return inPlace.dataValue;
                }
                return this.#last ?? bad(StatusCodes.BadWaitingForInitialData);
            }
            default:
                return this.#host.attributeFor(context, this, attributeId) ?? bad(StatusCodes.BadWaitingForInitialData);
        }
    }
    /** what the samplers call: in place when it can be, else from the engine, with the session's permissions */
    readValueAsync(context, callback) {
        this.#context = context;
        if (this.#disposed || !this.#host.isAlive(this)) {
            this.dispose();
            callback(null, bad(StatusCodes.BadNodeIdUnknown));
            return;
        }
        const inPlace = this.#host.valueInPlace(this);
        if (inPlace) {
            this.#note(inPlace.dataValue, inPlace.version);
            callback(null, inPlace.dataValue);
            return;
        }
        this.#host.fetchValue(context, this).then(({ dataValue, version }) => {
            if (version < 0) {
                this.dispose();
                callback(null, bad(StatusCodes.BadNodeIdUnknown));
                return;
            }
            this.#note(dataValue, version);
            callback(null, dataValue);
        }, (err) => callback(err));
    }
    /**
     * a value the engine pushed: reported unless a newer one was already seen. Under a permission
     * rule it is not the item's to see as it is: the item's session reads the value again
     */
    deliver(dataValue, version) {
        if (!this.#trusted && !this.#host.isReadableByAll(this)) {
            this.#readAgain();
            return;
        }
        if (this.#note(dataValue, version)) {
            this.emit("value_changed", dataValue);
        }
    }
    /** one read at a time; the changes pushed meanwhile make one more */
    #readAgain() {
        if (this.#context === undefined || this.#disposed) {
            // no read yet: the item's first read applies the session's permissions
            return;
        }
        if (this.#refetching) {
            this.#refetchAgain = true;
            return;
        }
        this.#refetching = true;
        this.#host.fetchValue(this.#context, this).then(({ dataValue, version }) => {
            this.#refetching = false;
            if (version >= 0 && this.#note(dataValue, version)) {
                this.emit("value_changed", dataValue);
            }
            if (this.#refetchAgain) {
                this.#refetchAgain = false;
                this.#readAgain();
            }
        }, () => {
            this.#refetching = false;
        });
    }
    /** the node was deleted: what a monitored item listens to, as on the node objects */
    dispose() {
        if (this.#disposed)
            return;
        this.#disposed = true;
        this.#stopWatchingRange();
        this.emit("dispose");
    }
    /** true when the value is newer than every value seen so far (version words wrap) */
    #note(dataValue, version) {
        if (this.#version >= 0 && ((version - this.#version) | 0) <= 0) {
            return false;
        }
        this.#version = version;
        this.#last = dataValue;
        return true;
    }
}
_a = FrontMonitoredNode;
//# sourceMappingURL=front_node.js.map