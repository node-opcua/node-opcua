import type { BinaryStream } from "node-opcua-binary-stream";
import type { NodeId } from "node-opcua-nodeid";
import type { Message, ServerSecureChannelLayer } from "node-opcua-secure-channel";
import type { ServerSession } from "./server_session.js";
export interface LeanSessions {
    getSession(authenticationToken: NodeId, activeOnly?: boolean): ServerSession | null;
}
export interface LeanRequestHeader {
    session: ServerSession;
    requestHandle: number;
    returnDiagnostics: number;
}
/**
 * the RequestHeader at the position of `stream`, and the session it names when that session is active on
 * `channel`; null for anything else (an additional header, another session), which the normal path reports
 */
export declare function readLeanRequestHeader(sessions: LeanSessions, channel: ServerSecureChannelLayer, stream: BinaryStream): LeanRequestHeader | null;
/** what send_response takes from a request: its handle, its diagnostics, the name of its service */
export declare function leanMessage(channel: ServerSecureChannelLayer, header: LeanRequestHeader, schema: {
    name: string;
}, requestId: number, securityHeader: Message["securityHeader"]): Message;
//# sourceMappingURL=lean_request.d.ts.map