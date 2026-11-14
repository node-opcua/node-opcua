/**
 * @module node-opcua-server
 */
// A Read of Values its server reads at once, answered from the bytes of the request: no ReadRequest,
// RequestHeader nor ReadValueId is made, and the service dispatch is skipped. Anything else (another
// attribute, an index range, a data encoding, a node its host leaves to the normal path, a session or
// channel that is not right) returns false and the request is decoded and served as any other, which
// reports what is wrong.
import { decodeNodeId } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { AttributeIds } from "node-opcua-data-model";
import { ReadRequest, ReadResponse } from "node-opcua-types";
import { leanMessage, readLeanRequestHeader } from "./lean_request.js";
/** ReadRequest_Encoding_DefaultBinary */
const READ_REQUEST = 631;
export function leanRead(host, channel, typeId, body, offset, requestId, securityHeader) {
    if (typeId !== READ_REQUEST)
        return false;
    try {
        const stream = new BinaryStream(body);
        stream.length = offset;
        const header = readLeanRequestHeader(host, channel, stream);
        if (!header)
            return false;
        const maxAge = stream.readDouble();
        const timestampsToReturn = stream.readUInt32();
        const count = stream.readInteger();
        if (!(maxAge >= 0) || timestampsToReturn > 3 || count <= 0)
            return false;
        if (host.maxNodesPerRead > 0 && count > host.maxNodesPerRead)
            return false;
        const items = new Array(count);
        for (let k = 0; k < count; k++) {
            const nodeId = decodeNodeId(stream);
            if (stream.readUInt32() !== AttributeIds.Value)
                return false;
            if (stream.readInteger() > 0)
                return false; // an indexRange
            stream.length += 2; // dataEncoding: namespace
            if (stream.readInteger() > 0)
                return false; // dataEncoding: a name
            const item = host.itemOf(nodeId);
            if (item === null)
                return false;
            items[k] = item;
        }
        if (stream.length !== body.length)
            return false;
        const session = header.session;
        session.keepAlive?.();
        session.incrementTotalRequestCount();
        const results = host.read(session.sessionContext, items, maxAge, timestampsToReturn);
        const response = new ReadResponse(null);
        response.results = results;
        session.incrementRequestTotalCounter("Read");
        channel.send_response("MSG", response, leanMessage(channel, header, ReadRequest.schema, requestId, securityHeader));
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=lean_read.js.map