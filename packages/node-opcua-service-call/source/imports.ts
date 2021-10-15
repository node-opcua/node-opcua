/**
 * @module node-opcua-service-browse
 */
import { assert } from "node-opcua-assert";
import { coerceNodeId, NodeId, resolveNodeId } from "node-opcua-nodeid";
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
function constructHookArgument(options?: { dataType: any; valueRank?: number; arrayDimensions?: any }): any {
    options = options || { dataType: DataType.Null };

    let dataType = options.dataType;
    if (dataType) {
        if (typeof dataType === "string") {
            dataType = resolveNodeId(dataType);
        } else if (dataType instanceof NodeId) {
            // nothing
        } else if (dataType.value) {
            assert(Object.prototype.hasOwnProperty.call(dataType, "namespace"));
            dataType = coerceNodeId(dataType.value, dataType.namespace);
        } else {
            assert(typeof dataType === "number");
        }
        options.dataType = dataType;
    }
    if (options.valueRank === undefined) {
        options.valueRank = -1;
    }
    // fix missing ArrayDimension (The value is an array with one dimension.)
    if (options.valueRank !== 1 || !options.arrayDimensions) {
        options.arrayDimensions = [0];
    }

    return options;
}

Argument.schema.constructHook = constructHookArgument;
