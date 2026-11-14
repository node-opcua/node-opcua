/**
 * @module node-opcua-server
 */
// What the lean services (lean_read.ts, lean_write.ts) share: the RequestHeader read from the bytes of a
// request, the checks of prepare() and _apply_on_SessionObject() on its session, and the message
// send_response() takes to answer it.
import { decodeNodeId } from "node-opcua-basic-types";
/**
 * the RequestHeader at the position of `stream`, and the session it names when that session is active on
 * `channel`; null for anything else (an additional header, another session), which the normal path reports
 */
export function readLeanRequestHeader(sessions, channel, stream) {
    const body = stream.buffer;
    const authenticationToken = decodeNodeId(stream);
    stream.length += 8; // timestamp
    const requestHandle = stream.readUInt32();
    const returnDiagnostics = stream.readUInt32();
    const auditEntryId = stream.readInteger();
    if (auditEntryId > 0)
        stream.length += auditEntryId;
    stream.length += 4; // timeoutHint
    // additionalHeader: an ExtensionObject without a body (NodeId i=0, no encoding)
    if (body[stream.length] !== 0 || body[stream.length + 1] !== 0 || body[stream.length + 2] !== 0)
        return null;
    stream.length += 3;
    const session = sessions.getSession(authenticationToken, true);
    if (!session || session.status !== "active" || session.channel !== channel || session.channelId !== channel.channelId) {
        return null;
    }
    return { session, requestHandle, returnDiagnostics };
}
/** what send_response takes from a request: its handle, its diagnostics, the name of its service */
export function leanMessage(channel, header, schema, requestId, securityHeader) {
    const request = { requestHeader: { requestHandle: header.requestHandle, returnDiagnostics: header.returnDiagnostics }, schema };
    return { channel, request, requestId, securityHeader, session: header.session };
}
//# sourceMappingURL=lean_request.js.map