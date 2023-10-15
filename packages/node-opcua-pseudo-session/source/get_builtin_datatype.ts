import { AttributeIds } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { IBasicSessionBrowseAsyncSimple, IBasicSessionReadAsyncSimple } from "./basic_session_interface";
import { findBasicDataType } from "./find_basic_datatype";

export async function getBuiltInDataType(
    session: IBasicSessionBrowseAsyncSimple & IBasicSessionReadAsyncSimple,
    variableNodeId: NodeId
): Promise<DataType> {
    let dataTypeId = null;
    const nodeToRead = {
        attributeId: AttributeIds.DataType,
        nodeId: variableNodeId
    };
    const dataValue = await session.read(nodeToRead);
    /* istanbul ignore next */
    if (dataValue.statusCode.isNot(StatusCodes.Good)) {
        throw new Error("cannot read DataType Attribute " + dataValue.statusCode.toString() + " for nodeId "+ variableNodeId.toString());
    }
    dataTypeId = dataValue.value.value;
    return await findBasicDataType(session, dataTypeId);
}
