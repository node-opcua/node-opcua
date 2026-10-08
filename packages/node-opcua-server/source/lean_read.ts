/**
 * @module node-opcua-server
 */
// A Read of Values its server reads at once, answered from the bytes of the request: no ReadRequest,
// RequestHeader nor ReadValueId is made, and the service dispatch is skipped. Anything else (another
// attribute, an index range, a data encoding, a node its host leaves to the normal path, a session or
// channel that is not right) returns false and the request is decoded and served as any other, which
// reports what is wrong.

import type { ISessionContext } from "node-opcua-address-space-base";
import { decodeNodeId } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { AttributeIds } from "node-opcua-data-model";
import type { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import type { NodeId } from "node-opcua-nodeid";
import type { Message, ServerSecureChannelLayer } from "node-opcua-secure-channel";
import { ReadRequest, ReadResponse } from "node-opcua-types";
import type { ServerSession } from "./server_session.js";

/** ReadRequest_Encoding_DefaultBinary */
const READ_REQUEST = 631;

/** what a server gives the lean Read: its sessions, its limit, and how it reads the Value of a node */
export interface LeanReadHost<T> {
    getSession(authenticationToken: NodeId, activeOnly?: boolean): ServerSession | null;
    readonly maxNodesPerRead: number;
    /** what read() takes for the Value of this node; null for a node left to the normal path */
    itemOf(nodeId: NodeId): T | null;
    /** the Values of the items, in their order */
    read(context: ISessionContext, items: T[], maxAge: number, timestampsToReturn: TimestampsToReturn): DataValue[];
}

export function leanRead<T>(
    host: LeanReadHost<T>,
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

        const items: T[] = new Array(count);
        for (let k = 0; k < count; k++) {
            const nodeId = decodeNodeId(stream);
            if (stream.readUInt32() !== AttributeIds.Value) return false;
            if (stream.readInteger() > 0) return false; // an indexRange
            stream.length += 2; // dataEncoding: namespace
            if (stream.readInteger() > 0) return false; // dataEncoding: a name
            const item = host.itemOf(nodeId);
            if (item === null) return false;
            items[k] = item;
        }
        if (stream.length !== body.length) return false;

        session.keepAlive?.();
        session.incrementTotalRequestCount();
        const results = host.read(session.sessionContext, items, maxAge, timestampsToReturn as TimestampsToReturn);
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
    }
}
