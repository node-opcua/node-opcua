/**
 * @module node-opcua-server
 */
import type { ISessionContext } from "node-opcua-address-space-base";
import type { Message, ServerSecureChannelLayer } from "node-opcua-secure-channel";
import { type StatusCode } from "node-opcua-status-code";
import { type LeanSessions } from "./lean_request.js";
export interface LeanWriteHost extends LeanSessions {
    readonly maxNodesPerWrite: number;
    /** the statuses of the WriteValues encoded in `nodesToWrite` (their count, then them); null to leave them to the normal path */
    write(context: ISessionContext, nodesToWrite: Uint8Array, count: number): Promise<StatusCode[]> | null;
}
export declare function leanWrite(host: LeanWriteHost, channel: ServerSecureChannelLayer, typeId: number, body: Buffer, offset: number, requestId: number, securityHeader: Message["securityHeader"]): boolean;
//# sourceMappingURL=lean_write.d.ts.map