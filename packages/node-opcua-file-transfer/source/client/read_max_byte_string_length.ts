import { AttributeIds } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { VariableIds } from "node-opcua-constants";
import { resolveNodeId } from "node-opcua-nodeid";
import { IBasicSession } from "node-opcua-pseudo-session";
import { StatusCodes } from "node-opcua-status-code";


export async  function readMaxByteStringLength(session: IBasicSession): Promise<number> {
    const dataValue = await session.read({
        nodeId: resolveNodeId(VariableIds.Server_ServerCapabilities_MaxByteStringLength),
        attributeId: AttributeIds.Value
    });
    if (dataValue.statusCode !== StatusCodes.Good) {
        return 1024;
    }
    return dataValue.value.value || BinaryStream.maxByteStringLength;
}


