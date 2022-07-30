import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";

import { IBasicSession } from "./basic_session_interface";
import { findBasicDataType } from "./find_basic_datatype";

export function getBuiltInDataType(session: IBasicSession, variableNodeId: NodeId): Promise<DataType>;
export function getBuiltInDataType(
    session: IBasicSession,
    variableNodeId: NodeId,
    callback: (err: Error | null, dataType?: DataType) => void
): void;

export function getBuiltInDataType(
    session: IBasicSession,
    variableNodeId: NodeId,
    callback?: (err: Error | null, dataType?: DataType) => void
): any {
    if (typeof callback !== "function") {
        throw new Error("Expecting a callback");
    }
    let dataTypeId = null;
    const nodeToRead = {
        attributeId: AttributeIds.DataType,
        nodeId: variableNodeId
    };
    session.read(nodeToRead, (err: Error | null, dataValue?: DataValue) => {
        if (err) {
            return callback(err);
        }
        /* istanbul ignore next */
        if (!dataValue) {
            return callback(new Error("Internal Error"));
        }
        /* istanbul ignore next */
        if (dataValue.statusCode.isNot(StatusCodes.Good)) {
            return callback(new Error("cannot read DataType Attribute " + dataValue.statusCode.toString()));
        }
        dataTypeId = dataValue.value.value;
        findBasicDataType(session, dataTypeId, callback);
    });
}
const thenify = require("thenify");
exports.getBuiltInDataType = thenify.withCallback(exports.getBuiltInDataType);
