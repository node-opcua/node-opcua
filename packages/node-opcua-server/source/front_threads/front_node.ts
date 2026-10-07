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

import { EventEmitter } from "node:events";
import type { ISessionContext } from "node-opcua-address-space";
import { AttributeIds, NodeClass, QualifiedName } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import type { EventFilter } from "node-opcua-service-filter";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import type { EventFilterResult } from "node-opcua-types";
import { Range } from "node-opcua-types";
import { DataType, type Variant, type VariantOptions } from "node-opcua-variant";
import type { CompactMonitorableNode, EventItemIdentity } from "../monitorable_node.js";
import type { NodeDescription } from "./protocol.js";

/** what a node asks of the backend of its front thread */
export interface FrontNodeHost {
    /** false once the node is deleted (or its index given to another node) */
    isAlive(node: FrontMonitoredNode): boolean;
    /** true when every session may read the node's value: no permission rule, readable access levels */
    isReadableByAll(node: FrontMonitoredNode): boolean;
    /** the value read in place, with its version; null when it must be asked to the engine */
    valueInPlace(node: FrontMonitoredNode): { dataValue: DataValue; version: number } | null;
    /** the value as the engine reads it for this session; version -1 when the node is gone */
    fetchValue(context: ISessionContext | null, node: FrontMonitoredNode): Promise<{ dataValue: DataValue; version: number }>;
    minimumSamplingInterval(node: FrontMonitoredNode): number;
    /** an attribute other than the Value, as the engine read it for this session when the item was created */
    attributeFor(context: ISessionContext | null, node: FrontMonitoredNode, attributeId: AttributeIds): DataValue | undefined;
    watch(node: FrontMonitoredNode): void;
    unwatch(node: FrontMonitoredNode): void;
    /** the events of the node, filtered by the engine for an item */
    subscribeEvents(
        nodeId: NodeId,
        filter: EventFilter,
        context: ISessionContext | null,
        onFields: (fields: Variant[]) => void,
        item?: EventItemIdentity
    ): () => void;
    /** the result of the filter of an event item, checked by the engine before the item was created */
    eventFilterResult(filter: EventFilter): EventFilterResult | undefined;
}

function good(value: VariantOptions): DataValue {
    return new DataValue({ statusCode: StatusCodes.Good, value });
}
function bad(statusCode: StatusCode): DataValue {
    return new DataValue({ statusCode });
}

export class FrontMonitoredNode extends EventEmitter implements CompactMonitorableNode {
    public readonly nodeId: NodeId;
    public readonly nodeClass: NodeClass;
    public readonly browseName: QualifiedName;
    public readonly dataType?: NodeId;
    public readonly index: number;
    public readonly generation: number;
    readonly #host: FrontNodeHost;
    readonly #isNumber: boolean;
    // a node watched for the front itself (the EURange of a deadband): its values need no session
    readonly #trusted: boolean;
    #euRange: [number, number] | null;
    readonly #euRangeNode: NodeDescription["euRangeNode"];
    #rangeWatch: FrontMonitoredNode | null = null;
    // the session of the item, from its reads: what a value pushed under a permission rule is read again with
    #context: ISessionContext | null | undefined = undefined;
    #refetching = false;
    #refetchAgain = false;
    // the newest value seen and its version word; -1: none yet
    #version = -1;
    #last: DataValue | null = null;
    #watching = false;
    #disposed = false;

    constructor(host: FrontNodeHost, nodeId: NodeId, description: NodeDescription, trusted = false) {
        super();
        this.#host = host;
        this.#trusted = trusted;
        this.nodeId = nodeId;
        this.index = description.index;
        this.generation = description.generation;
        this.nodeClass = description.nodeClass as NodeClass;
        this.browseName = new QualifiedName({ namespaceIndex: description.namespaceIndex, name: description.name });
        this.dataType = description.dataType ? resolveNodeId(description.dataType) : undefined;
        this.#euRange = description.euRange;
        this.#euRangeNode = description.euRangeNode;
        this.#isNumber = description.isNumber;
        this.on("newListener", (event: string | symbol) => {
            if (event === "value_changed" && !this.#watching && !this.#disposed) {
                this.#watching = true;
                this.#host.watch(this);
            }
        });
        this.on("removeListener", (event: string | symbol) => {
            if (event === "value_changed" && this.#watching && this.listenerCount("value_changed") === 0) {
                this.#watching = false;
                this.#host.unwatch(this);
            }
            // every monitored item listens to "dispose" until it ends
            if (event === "dispose" && this.listenerCount("dispose") === 0) {
                this.#stopWatchingRange();
            }
        });
    }

    public get minimumSamplingInterval(): number {
        return this.#host.minimumSamplingInterval(this);
    }

    public subscribeEvents(
        filter: EventFilter,
        context: ISessionContext | null,
        onFields: (fields: Variant[]) => void,
        item?: EventItemIdentity
    ): () => void {
        return this.#host.subscribeEvents(this.nodeId, filter, context, onFields, item);
    }

    public analyzeEventFilter(filter: EventFilter): EventFilterResult | undefined {
        return this.#host.eventFilterResult(filter);
    }

    public isNumberDataType(): boolean {
        return this.#isNumber;
    }

    /** only the EURange property, for a percent deadband: its current value, watched from its first read */
    public getChildByName(name: string): unknown {
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

    #watchRange(): void {
        const property = this.#euRangeNode;
        if (this.#rangeWatch || !property || this.#disposed) return;
        const watch = new FrontMonitoredNode(
            this.#host,
            resolveNodeId(property.nodeId),
            {
                index: property.index,
                generation: property.generation,
                nodeClass: NodeClass.Variable,
                namespaceIndex: 0,
                name: "EURange",
                dataType: null,
                isNumber: false,
                euRange: null,
                euRangeNode: null
            },
            true
        );
        watch.on("value_changed", this.#onRange);
        this.#rangeWatch = watch;
    }

    #stopWatchingRange(): void {
        this.#rangeWatch?.removeListener("value_changed", this.#onRange);
        this.#rangeWatch = null;
    }

    readonly #onRange = (dataValue: DataValue): void => {
        const range = dataValue.value?.value as { low?: unknown; high?: unknown } | null;
        if (range && typeof range.low === "number" && typeof range.high === "number") {
            this.#euRange = [range.low, range.high];
        }
    };

    public readAttribute(context: ISessionContext | null, attributeId: AttributeIds): DataValue {
        this.#context = context;
        switch (attributeId) {
            case AttributeIds.NodeId:
                return good({ dataType: DataType.NodeId, value: this.nodeId });
            case AttributeIds.NodeClass:
                return good({ dataType: DataType.Int32, value: this.nodeClass });
            case AttributeIds.BrowseName:
                return good({ dataType: DataType.QualifiedName, value: this.browseName });
            case AttributeIds.DataType:
                return this.dataType
                    ? good({ dataType: DataType.NodeId, value: this.dataType })
                    : bad(StatusCodes.BadAttributeIdInvalid);
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
    public readValueAsync(context: ISessionContext | null, callback: (err: Error | null, dataValue?: DataValue) => void): void {
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
        this.#host.fetchValue(context, this).then(
            ({ dataValue, version }) => {
                if (version < 0) {
                    this.dispose();
                    callback(null, bad(StatusCodes.BadNodeIdUnknown));
                    return;
                }
                this.#note(dataValue, version);
                callback(null, dataValue);
            },
            (err: Error) => callback(err)
        );
    }

    /**
     * a value the engine pushed: reported unless a newer one was already seen. Under a permission
     * rule it is not the item's to see as it is: the item's session reads the value again
     */
    public deliver(dataValue: DataValue, version: number): void {
        if (!this.#trusted && !this.#host.isReadableByAll(this)) {
            this.#readAgain();
            return;
        }
        if (this.#note(dataValue, version)) {
            this.emit("value_changed", dataValue);
        }
    }

    /** one read at a time; the changes pushed meanwhile make one more */
    #readAgain(): void {
        if (this.#context === undefined || this.#disposed) {
            // no read yet: the item's first read applies the session's permissions
            return;
        }
        if (this.#refetching) {
            this.#refetchAgain = true;
            return;
        }
        this.#refetching = true;
        this.#host.fetchValue(this.#context, this).then(
            ({ dataValue, version }) => {
                this.#refetching = false;
                if (version >= 0 && this.#note(dataValue, version)) {
                    this.emit("value_changed", dataValue);
                }
                if (this.#refetchAgain) {
                    this.#refetchAgain = false;
                    this.#readAgain();
                }
            },
            () => {
                this.#refetching = false;
            }
        );
    }

    /** the node was deleted: what a monitored item listens to, as on the node objects */
    public dispose(): void {
        if (this.#disposed) return;
        this.#disposed = true;
        this.#stopWatchingRange();
        this.emit("dispose");
    }

    /** true when the value is newer than every value seen so far (version words wrap) */
    #note(dataValue: DataValue, version: number): boolean {
        if (this.#version >= 0 && ((version - this.#version) | 0) <= 0) {
            return false;
        }
        this.#version = version;
        this.#last = dataValue;
        return true;
    }
}
