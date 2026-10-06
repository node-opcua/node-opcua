/**
 * @module node-opcua-server
 *
 * A node of the compact namespaces as a monitored item in a front thread sees it. What does not
 * depend on the session (class, name, DataType, EURange) was described by the engine when the
 * item was created; the value is read in place when no permission rule applies to it, else asked
 * to the engine. A listener to value_changed makes the front watch the node: the engine, the only
 * writer, then pushes every value written to it. A version word orders the values whatever path
 * they came by, so that an item never goes back to an older value.
 */
import { EventEmitter } from "node:events";
import type { ISessionContext } from "node-opcua-address-space";
import { AttributeIds, NodeClass, QualifiedName } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { Range } from "node-opcua-types";
import { DataType, type VariantOptions } from "node-opcua-variant";
import type { CompactMonitorableNode } from "../monitorable_node.js";
import type { NodeDescription } from "./protocol.js";

/** what a node asks of the backend of its front thread */
export interface FrontNodeHost {
    /** false once the node is deleted (or its index given to another node) */
    isAlive(node: FrontMonitoredNode): boolean;
    /** the value read in place, with its version; null when it must be asked to the engine */
    valueInPlace(node: FrontMonitoredNode): { dataValue: DataValue; version: number } | null;
    /** the value as the engine reads it for this session; version -1 when the node is gone */
    fetchValue(context: ISessionContext | null, node: FrontMonitoredNode): Promise<{ dataValue: DataValue; version: number }>;
    minimumSamplingInterval(node: FrontMonitoredNode): number;
    /** an attribute other than the Value, as the engine read it for this session when the item was created */
    attributeFor(context: ISessionContext | null, node: FrontMonitoredNode, attributeId: AttributeIds): DataValue | undefined;
    watch(node: FrontMonitoredNode): void;
    unwatch(node: FrontMonitoredNode): void;
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
    readonly #euRange: [number, number] | null;
    readonly #isNumber: boolean;
    // the newest value seen and its version word; -1: none yet
    #version = -1;
    #last: DataValue | null = null;
    #watching = false;
    #disposed = false;

    constructor(host: FrontNodeHost, nodeId: NodeId, description: NodeDescription) {
        super();
        this.#host = host;
        this.nodeId = nodeId;
        this.index = description.index;
        this.generation = description.generation;
        this.nodeClass = description.nodeClass as NodeClass;
        this.browseName = new QualifiedName({ namespaceIndex: description.namespaceIndex, name: description.name });
        this.dataType = description.dataType ? resolveNodeId(description.dataType) : undefined;
        this.#euRange = description.euRange;
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
        });
    }

    public get minimumSamplingInterval(): number {
        return this.#host.minimumSamplingInterval(this);
    }

    public isNumberDataType(): boolean {
        return this.#isNumber;
    }

    /** only the EURange property, for a percent deadband: its value as it was when the item was created */
    public getChildByName(name: string): unknown {
        const range = this.#euRange;
        if (name !== "EURange" || !range) {
            return null;
        }
        return {
            nodeClass: NodeClass.Variable,
            browseName: new QualifiedName({ name: "EURange" }),
            readValue: () => good({ dataType: DataType.ExtensionObject, value: new Range({ low: range[0], high: range[1] }) })
        };
    }

    public readAttribute(context: ISessionContext | null, attributeId: AttributeIds): DataValue {
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

    /** a value the engine pushed: reported unless a newer one was already seen */
    public deliver(dataValue: DataValue, version: number): void {
        if (this.#note(dataValue, version)) {
            this.emit("value_changed", dataValue);
        }
    }

    /** the node was deleted: what a monitored item listens to, as on the node objects */
    public dispose(): void {
        if (this.#disposed) return;
        this.#disposed = true;
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
