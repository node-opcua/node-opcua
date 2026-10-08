/**
 * @module node-opcua-server
 */
// A Read whose items a front serves in place, answered from the bytes of the request: no ReadRequest,
// RequestHeader, ReadValueId nor NodeId of an item is made. Anything else (another attribute, an index
// range, a data encoding, a node the engine reads, a session or channel that is not right) returns false
// and the request is decoded and served as any other, which reports what is wrong.
import { decodeNodeId } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { AttributeIds } from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";
import type { NodeId } from "node-opcua-nodeid";
import type { Message, ServerSecureChannelLayer } from "node-opcua-secure-channel";
import { ReadRequest, ReadResponse } from "node-opcua-types";
import type { ServerSession } from "../server_session.js";
import type { RemoteCompactBackend } from "./remote_backend.js";

/** ReadRequest_Encoding_DefaultBinary */
const READ_REQUEST = 631;

export interface LeanReadHost {
    getSession(authenticationToken: NodeId, activeOnly?: boolean): ServerSession | null;
    readonly maxNodesPerRead: number;
    readonly backend: RemoteCompactBackend;
}

const item = { nodeId: null as unknown as NodeId, attributeId: AttributeIds.Value };
let indexes = new Int32Array(128);

export function leanRead(
    host: LeanReadHost,
    channel: ServerSecureChannelLayer,
    typeId: number,
    body: Buffer,
    offset: number,
    requestId: number,
    securityHeader: Message["securityHeader"]
): boolean {
    if (typeId !== READ_REQUEST) return false;
    try {
        const stream = new BinaryStream(body);
        stream.length = offset;
        // RequestHeader
        const authenticationToken = decodeNodeId(stream);
        stream.length += 8; // timestamp
        const requestHandle = stream.readUInt32();
        const returnDiagnostics = stream.readUInt32();
        const auditEntryId = stream.readInteger();
        if (auditEntryId > 0) stream.length += auditEntryId;
        stream.length += 4; // timeoutHint
        // additionalHeader: an ExtensionObject without a body (NodeId i=0, no encoding)
        if (body[stream.length] !== 0 || body[stream.length + 1] !== 0 || body[stream.length + 2] !== 0) return false;
        stream.length += 3;
        const maxAge = stream.readDouble();
        const timestampsToReturn = stream.readUInt32();
        const count = stream.readInteger();
        if (!(maxAge >= 0) || timestampsToReturn > 3 || count <= 0) return false;
        if (host.maxNodesPerRead > 0 && count > host.maxNodesPerRead) return false;

        // the checks of prepare() and _apply_on_SessionObject(): an active session, of this channel
        const session = host.getSession(authenticationToken, true);
        if (!session || session.status !== "active" || session.channel !== channel || session.channelId !== channel.channelId) {
            return false;
        }

        if (indexes.length < count) indexes = new Int32Array(count * 2);
        const backend = host.backend;
        for (let k = 0; k < count; k++) {
            item.nodeId = decodeNodeId(stream);
            if (stream.readUInt32() !== AttributeIds.Value) return false;
            if (stream.readInteger() > 0) return false; // an indexRange
            stream.length += 2; // dataEncoding: namespace
            if (stream.readInteger() > 0) return false; // dataEncoding: a name
            const i = backend.inPlaceIndex(item);
            if (i < 0) return false;
            indexes[k] = i;
        }
        if (stream.length !== body.length) return false;

        session.keepAlive?.();
        session.incrementTotalRequestCount();
        const context = session.sessionContext;
        const results: DataValue[] = new Array(count);
        for (let k = 0; k < count; k++) results[k] = backend.readAt(indexes[k], context, maxAge, timestampsToReturn);
        const response = new ReadResponse(null);
        response.results = results;
        session.incrementRequestTotalCounter("Read");
        // what send_response takes from a request: its handle, its diagnostics, the name of its service
        const request = { requestHeader: { requestHandle, returnDiagnostics }, schema: ReadRequest.schema };
        const message = { channel, request, requestId, securityHeader, session } as unknown as Message;
        channel.send_response("MSG", response, message);
        return true;
    } catch {
        return false;
    } finally {
        item.nodeId = null as unknown as NodeId;
    }
}
