/**
 * @module node-opcua-address-space-store
 *
 * Read of one attribute of a node from the store, by index, as the plain fields a DataValue
 * is made of. The caller (the address space, a service) turns them into its DataValue; the
 * store does not depend on that type.
 */
import { AttributeIds, LocalizedText, NodeClass, QualifiedName } from "node-opcua-data-model";
import { type NodeId, NodeIdType } from "node-opcua-nodeid";
import { DataType, VariantArrayType } from "node-opcua-variant";
import type { CompactStore } from "./compact_store.js";
import { NO_NODE } from "./node_id_index.js";
import { ValueKind } from "./value_store.js";

/** OPC UA status codes the reader answers with */
export enum ReadStatus {
    Good = 0,
    BadAttributeIdInvalid = 0x80350000,
    BadNodeIdUnknown = 0x80340000,
    BadWaitingForInitialData = 0x80320000
}

export interface AttributeValue {
    statusCode: number;
    dataType: DataType;
    arrayType: VariantArrayType;
    value: unknown;
    /** milliseconds since the epoch, 0 when the attribute carries no timestamp of its own */
    sourceTimestamp: number;
    sourcePicoseconds: number;
}

const NULL_NODE_ID: NodeId | null = null;

/** which attributes a node class has, as a mask of 1 << attributeId */
function attributesOf(nodeClass: NodeClass): number {
    const common =
        bit(AttributeIds.NodeId) |
        bit(AttributeIds.NodeClass) |
        bit(AttributeIds.BrowseName) |
        bit(AttributeIds.DisplayName) |
        bit(AttributeIds.Description) |
        bit(AttributeIds.WriteMask) |
        bit(AttributeIds.UserWriteMask);
    switch (nodeClass) {
        case NodeClass.Object:
            return common | bit(AttributeIds.EventNotifier);
        case NodeClass.Variable:
            return (
                common |
                bit(AttributeIds.Value) |
                bit(AttributeIds.DataType) |
                bit(AttributeIds.ValueRank) |
                bit(AttributeIds.ArrayDimensions) |
                bit(AttributeIds.AccessLevel) |
                bit(AttributeIds.UserAccessLevel) |
                bit(AttributeIds.MinimumSamplingInterval) |
                bit(AttributeIds.Historizing)
            );
        case NodeClass.VariableType:
            return (
                common |
                bit(AttributeIds.Value) |
                bit(AttributeIds.DataType) |
                bit(AttributeIds.ValueRank) |
                bit(AttributeIds.ArrayDimensions) |
                bit(AttributeIds.IsAbstract)
            );
        case NodeClass.ObjectType:
        case NodeClass.DataType:
            return common | bit(AttributeIds.IsAbstract);
        case NodeClass.ReferenceType:
            return common | bit(AttributeIds.IsAbstract) | bit(AttributeIds.Symmetric) | bit(AttributeIds.InverseName);
        case NodeClass.Method:
            return common | bit(AttributeIds.Executable) | bit(AttributeIds.UserExecutable);
        case NodeClass.View:
            return common | bit(AttributeIds.EventNotifier) | bit(AttributeIds.ContainsNoLoops);
        default:
            return common;
    }
}
function bit(attributeId: number): number {
    return 1 << attributeId;
}

export class AttributeReader {
    readonly #store: CompactStore;
    constructor(store: CompactStore) {
        this.#store = store;
    }

    public read(node: number, attributeId: AttributeIds): AttributeValue {
        const store = this.#store;
        const nodes = store.nodes;
        if (node === NO_NODE || node >= nodes.count || nodes.isDeleted(node)) {
            return bad(ReadStatus.BadNodeIdUnknown);
        }
        const nodeClass = nodes.nodeClass(node);
        if (attributeId <= 0 || attributeId > 27 || (attributesOf(nodeClass) & bit(attributeId)) === 0) {
            return bad(ReadStatus.BadAttributeIdInvalid);
        }
        switch (attributeId) {
            case AttributeIds.NodeId:
                return scalar(DataType.NodeId, nodes.nodeId(node));
            case AttributeIds.NodeClass:
                return scalar(DataType.Int32, nodeClass);
            case AttributeIds.BrowseName:
                return scalar(
                    DataType.QualifiedName,
                    new QualifiedName({ namespaceIndex: nodes.browseNameNamespace(node), name: nodes.browseName(node) })
                );
            case AttributeIds.DisplayName:
                return scalar(DataType.LocalizedText, new LocalizedText({ text: nodes.displayName(node) }));
            case AttributeIds.Description: {
                const text = nodes.description(node);
                return scalar(
                    DataType.LocalizedText,
                    text === null ? new LocalizedText({ text: "" }) : new LocalizedText({ text })
                );
            }
            case AttributeIds.WriteMask:
            case AttributeIds.UserWriteMask:
                // nothing of a compact node is writable through its attributes but the Value
                return scalar(DataType.UInt32, 0);
            case AttributeIds.IsAbstract:
                return scalar(DataType.Boolean, nodes.isAbstract(node));
            case AttributeIds.Symmetric:
                return scalar(DataType.Boolean, nodes.symmetric(node));
            case AttributeIds.InverseName: {
                const text = nodes.inverseName(node);
                return scalar(DataType.LocalizedText, new LocalizedText({ text: text ?? "" }));
            }
            case AttributeIds.ContainsNoLoops:
                return scalar(DataType.Boolean, nodes.containsNoLoops(node));
            case AttributeIds.Executable:
            case AttributeIds.UserExecutable:
                // a Method of the store is callable as far as the node knows; the server decides
                return scalar(DataType.Boolean, true);
            case AttributeIds.EventNotifier:
                return scalar(DataType.Byte, nodes.eventNotifier(node));
            case AttributeIds.DataType: {
                const t = nodes.dataType(node);
                return scalar(DataType.NodeId, t === NO_NODE ? NULL_NODE_ID : nodes.nodeId(t));
            }
            case AttributeIds.ValueRank:
                return scalar(DataType.Int32, nodes.valueRank(node));
            case AttributeIds.ArrayDimensions:
                return {
                    statusCode: ReadStatus.Good,
                    dataType: DataType.UInt32,
                    arrayType: VariantArrayType.Array,
                    value: null,
                    sourceTimestamp: 0,
                    sourcePicoseconds: 0
                };
            case AttributeIds.AccessLevel:
                return scalar(DataType.Byte, nodes.accessLevel(node));
            case AttributeIds.UserAccessLevel:
                return scalar(DataType.Byte, nodes.userAccessLevel(node));
            case AttributeIds.MinimumSamplingInterval:
                return scalar(DataType.Double, nodes.minimumSamplingInterval(node));
            case AttributeIds.Historizing:
                return scalar(DataType.Boolean, nodes.historizing(node));
            case AttributeIds.Value:
                return this.#value(node);
            default:
                return bad(ReadStatus.BadAttributeIdInvalid);
        }
    }

    #value(node: number): AttributeValue {
        const values = this.#store.values;
        const kind = values.kind(node);
        if (kind === ValueKind.None) {
            const status = values.statusCode(node);
            return bad(status === 0 ? ReadStatus.BadWaitingForInitialData : status);
        }
        const v = values.get(node);
        if (kind === ValueKind.Object) {
            // kept as the VariantOptions the loader produced: dataType, arrayType and value
            const options = v.value as { dataType?: unknown; arrayType?: unknown; value?: unknown } | null;
            return {
                statusCode: v.statusCode,
                dataType: v.dataType,
                arrayType: (options?.arrayType as VariantArrayType | undefined) ?? VariantArrayType.Scalar,
                value: options && "value" in options ? options.value : options,
                sourceTimestamp: v.sourceTimestamp,
                sourcePicoseconds: v.sourcePicoseconds
            };
        }
        return {
            statusCode: v.statusCode,
            dataType: v.dataType,
            arrayType: VariantArrayType.Scalar,
            value: v.value,
            sourceTimestamp: v.sourceTimestamp,
            sourcePicoseconds: v.sourcePicoseconds
        };
    }
}

function scalar(dataType: DataType, value: unknown): AttributeValue {
    return {
        statusCode: ReadStatus.Good,
        dataType,
        arrayType: VariantArrayType.Scalar,
        value,
        sourceTimestamp: 0,
        sourcePicoseconds: 0
    };
}
function bad(statusCode: number): AttributeValue {
    return {
        statusCode,
        dataType: DataType.Null,
        arrayType: VariantArrayType.Scalar,
        value: null,
        sourceTimestamp: 0,
        sourcePicoseconds: 0
    };
}

export { NodeIdType };
