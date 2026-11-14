/**
 * @module node-opcua-server
 */
// A Write answered from the bytes of the request: no WriteRequest nor RequestHeader is made and the service
// dispatch is skipped; the WriteValues go to the host as the client encoded them (a front hands them to the
// engine as they are). A session with registered nodes, too many items, or anything the header check
// refuses returns false and the request is decoded and served as any other.
import { BinaryStream } from "node-opcua-binary-stream";
import { StatusCodes } from "node-opcua-status-code";
import { ServiceFault, WriteRequest, WriteResponse } from "node-opcua-types";
import { leanMessage, readLeanRequestHeader } from "./lean_request.js";
/** WriteRequest_Encoding_DefaultBinary */
const WRITE_REQUEST = 673;
/** the Writes of a channel answered this way at the same time, as the channel lets requests be in progress */
const MAX_WRITES_IN_PROGRESS = 64;
const inProgress = new WeakMap();
export function leanWrite(host, channel, typeId, body, offset, requestId, securityHeader) {
    if (typeId !== WRITE_REQUEST)
        return false;
    const writing = inProgress.get(channel) ?? 0;
    if (writing >= MAX_WRITES_IN_PROGRESS)
        return false;
    let header;
    let pending;
    try {
        const stream = new BinaryStream(body);
        stream.length = offset;
        header = readLeanRequestHeader(host, channel, stream);
        if (!header)
            return false;
        // a registered node is named by its alias in the bytes: the normal path resolves it
        if (header.session.hasRegisteredNodes())
            return false;
        const start = stream.length;
        const count = stream.readInteger();
        if (count <= 0)
            return false;
        if (host.maxNodesPerWrite > 0 && count > host.maxNodesPerWrite)
            return false;
        // a copy: the body may be a view into a buffer the transport reuses
        pending = host.write(header.session.sessionContext, new Uint8Array(body.subarray(start)), count);
        if (!pending)
            return false;
    }
    catch {
        return false;
    }
    const session = header.session;
    session.keepAlive?.();
    session.incrementTotalRequestCount();
    inProgress.set(channel, writing + 1);
    const message = leanMessage(channel, header, WriteRequest.schema, requestId, securityHeader);
    pending
        .then((results) => {
        session.incrementRequestTotalCounter("Write");
        channel.send_response("MSG", new WriteResponse({ results }), message);
    })
        .catch(() => {
        session.incrementRequestErrorCounter("Write");
        channel.send_response("MSG", new ServiceFault({ responseHeader: { serviceResult: StatusCodes.BadInternalError } }), message);
    })
        .finally(() => inProgress.set(channel, (inProgress.get(channel) ?? 1) - 1));
    return true;
}
//# sourceMappingURL=lean_write.js.map