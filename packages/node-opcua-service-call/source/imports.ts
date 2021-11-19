/**
 * @module node-opcua-service-browse
 */
import { assert } from "node-opcua-assert";
import { coerceNodeId, NodeId, NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { Argument } from "node-opcua-types";
import { DataType } from "node-opcua-variant";

export {
    Argument,
    ArgumentOptions,
    CallMethodRequest,
    CallMethodRequestOptions,
    CallRequest,
    CallRequestOptions,
    CallMethodResult,
    CallMethodResultOptions,
    CallResponse
} from "node-opcua-types";

///
interface constructHookArgumentOptions {
    dataType: DataType | NodeIdLike | string;
    valueRank?: number;
    arrayDimensions?: number[];
}
interface constructHookArgumentOptions2 {
    dataType: NodeId;
    valueRank?: number;
    arrayDimensions?: number[];
}
function _coerceToNodeId(n: NodeId | string | DataType): NodeId {
    const dataType: NodeId | string | DataType = n;

    if (!dataType) {
        return NodeId.nullNodeId;
    }
    if (typeof dataType === "string") {
        return resolveNodeId(dataType);
    }
    if (dataType instanceof NodeId) {
        return dataType;
    }
    if (Object.prototype.hasOwnProperty.call(dataType, "value")) {
        const a = dataType as unknown as { value: unknown; namespace?: number };
        return coerceNodeId(a.value, a.namespace);
    }
    assert(typeof dataType === "number");
    return coerceNodeId(dataType);
}
function constructHookArgument(_options?: constructHookArgumentOptions): constructHookArgumentOptions2 {
    const options = _options || { valueRank: -1, dataType: DataType.Null };

    const dataType = _coerceToNodeId(options.dataType);

    const valueRank = options.valueRank === undefined ? -1 : options.valueRank;

    // fix missing ArrayDimension (The value is an array with one dimension.)
    let arrayDimensions: number[] | undefined = options.arrayDimensions;
    if (valueRank > 0 && (!arrayDimensions || arrayDimensions.length === 0)) {
        arrayDimensions = new Array(options.valueRank).fill(0);
    }

    return { ... options, valueRank, dataType, arrayDimensions };
}

Argument.schema.constructHook = constructHookArgument;
