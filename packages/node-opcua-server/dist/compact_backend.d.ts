/**
 * @module node-opcua-server
 *
 * What serves the compact namespaces of a server: the compact address space of this thread, or,
 * in a front thread, the shared columns of the engine thread's store plus messages to the engine.
 * The accessor routes every NodeId of these namespaces here; the rest goes to the node objects.
 */
import type { CompactAddressSpace, ContinuationData, ISessionContext } from "node-opcua-address-space";
import type { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { type NodeId, type NodeIdLike } from "node-opcua-nodeid";
import { type HistoryReadDetails, HistoryReadResult, type HistoryReadValueId } from "node-opcua-service-history";
import { type StatusCode } from "node-opcua-status-code";
import type { BrowseDescription, BrowsePath, BrowsePathResult, BrowseResult, CallMethodRequest, CallMethodResultOptions, ReadValueIdOptions, ReferenceDescription, WriteValue } from "node-opcua-types";
import type { FoundNode } from "./monitorable_node.js";
export interface ICompactBackend {
    /** the namespace indexes served here */
    readonly namespaces: ReadonlySet<number>;
    /** one item of a Read, synchronously */
    read(context: ISessionContext | null, nodeToRead: ReadValueIdOptions, maxAge: number, timestampsToReturn?: TimestampsToReturn): DataValue;
    /** the items of a Write that fall in these namespaces, in their order */
    write(context: ISessionContext | null, nodesToWrite: WriteValue[]): Promise<StatusCode[]>;
    browse(context: ISessionContext | null, description: BrowseDescription): Promise<BrowseResult>;
    /** the references these namespaces add to a node of another namespace (a folder of the base namespace) */
    references(context: ISessionContext | null, nodeId: NodeId, description: BrowseDescription): Promise<ReferenceDescription[]>;
    /** a path followed in these namespaces from its start; null when it leads nowhere here */
    translate(browsePath: BrowsePath, context?: ISessionContext | null): Promise<BrowsePathResult | null>;
    /** a call of a Method of these namespaces */
    call?(context: ISessionContext | null, request: CallMethodRequest): Promise<CallMethodResultOptions>;
    /** a HistoryRead of a Variable of these namespaces */
    historyRead?(context: ISessionContext, nodeToRead: HistoryReadValueId, historyReadDetails: HistoryReadDetails, continuationData: ContinuationData): Promise<HistoryReadResult>;
    /** the node a monitored item watches; undefined where monitored items are not served yet */
    findNode?(nodeId: NodeIdLike): FoundNode | null;
}
/** the compact address space of this thread */
export declare class LocalCompactBackend implements ICompactBackend {
    #private;
    readonly namespaces: ReadonlySet<number>;
    constructor(space: CompactAddressSpace, namespaces: ReadonlySet<number>);
    read(context: ISessionContext | null, nodeToRead: ReadValueIdOptions, maxAge: number, timestampsToReturn?: TimestampsToReturn): DataValue;
    write(context: ISessionContext | null, nodesToWrite: WriteValue[]): Promise<StatusCode[]>;
    browse(context: ISessionContext | null, description: BrowseDescription): Promise<BrowseResult>;
    references(context: ISessionContext | null, nodeId: NodeId, description: BrowseDescription): Promise<ReferenceDescription[]>;
    translate(browsePath: BrowsePath, context?: ISessionContext | null): Promise<BrowsePathResult | null>;
    call(context: ISessionContext | null, request: CallMethodRequest): Promise<CallMethodResultOptions>;
    historyRead(context: ISessionContext, nodeToRead: HistoryReadValueId, historyReadDetails: HistoryReadDetails, continuationData: ContinuationData): Promise<HistoryReadResult>;
    findNode(nodeId: NodeIdLike): FoundNode | null;
}
//# sourceMappingURL=compact_backend.d.ts.map