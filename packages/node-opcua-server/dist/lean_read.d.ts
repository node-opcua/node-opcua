/**
 * @module node-opcua-server
 */
import type { ISessionContext } from "node-opcua-address-space-base";
import type { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import type { NodeId } from "node-opcua-nodeid";
import type { Message, ServerSecureChannelLayer } from "node-opcua-secure-channel";
import { type LeanSessions } from "./lean_request.js";
/** what a server gives the lean Read: its sessions, its limit, and how it reads the Value of a node */
export interface LeanReadHost<T> extends LeanSessions {
    readonly maxNodesPerRead: number;
    /** what read() takes for the Value of this node; null for a node left to the normal path */
    itemOf(nodeId: NodeId): T | null;
    /** the Values of the items, in their order */
    read(context: ISessionContext, items: T[], maxAge: number, timestampsToReturn: TimestampsToReturn): DataValue[];
}
export declare function leanRead<T>(host: LeanReadHost<T>, channel: ServerSecureChannelLayer, typeId: number, body: Buffer, offset: number, requestId: number, securityHeader: Message["securityHeader"]): boolean;
//# sourceMappingURL=lean_read.d.ts.map