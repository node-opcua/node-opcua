/**
 * @module node-opcua-server
 */
import type { Double, UInt32 } from "node-opcua-basic-types";
import type { QualifiedName } from "node-opcua-data-model";
import type { SignedSoftwareCertificate } from "node-opcua-types";
/**
 */
export interface OperationLimitsOptions {
    maxNodesPerRead?: number;
    maxNodesPerBrowse?: number;
    maxNodesPerWrite?: number;
    maxNodesPerMethodCall?: number;
    maxNodesPerRegisterNodes?: number;
    maxNodesPerNodeManagement?: number;
    maxMonitoredItemsPerCall?: number;
    maxNodesPerHistoryReadData?: number;
    maxNodesPerHistoryReadEvents?: number;
    maxNodesPerHistoryUpdateData?: number;
    maxNodesPerHistoryUpdateEvents?: number;
    maxNodesPerTranslateBrowsePathsToNodeIds?: number;
}
export declare class ServerOperationLimits {
    maxNodesPerRead: number;
    maxNodesPerBrowse: number;
    maxNodesPerWrite: number;
    maxNodesPerMethodCall: number;
    maxNodesPerRegisterNodes: number;
    maxNodesPerNodeManagement: number;
    maxMonitoredItemsPerCall: number;
    maxNodesPerHistoryReadData: number;
    maxNodesPerHistoryReadEvents: number;
    maxNodesPerHistoryUpdateData: number;
    maxNodesPerHistoryUpdateEvents: number;
    maxNodesPerTranslateBrowsePathsToNodeIds: number;
    constructor(options: OperationLimitsOptions);
}
export interface IServerCapabilities {
    maxBrowseContinuationPoints: number;
    maxHistoryContinuationPoints: number;
    maxStringLength: number;
    maxArrayLength: number;
    maxByteStringLength: number;
    maxQueryContinuationPoints: number;
    /**
     * MinSupportedSampleRate, in milliseconds: the fastest sampling interval the server
     * supports, and the floor of the revisedSamplingInterval it answers to a requested 0.
     * Defaults to MonitoredItem.minimumSamplingInterval (50 ms). A Variable whose
     * MinimumSamplingInterval is 0 is still delivered on change, the revised interval being
     * the window over which changes are coalesced. Set it to 0 to claim exception-based
     * acquisition: such items are then answered with a revisedSamplingInterval of 0 and every
     * change is reported (the CTT flags this for manual verification).
     */
    minSupportedSampleRate: Double;
    operationLimits: OperationLimitsOptions;
    serverProfileArray: string[];
    localeIdArray: string[];
    softwareCertificates: SignedSoftwareCertificate[];
    /**
     * MaxSessions is an integer specifying the maximum number of concurrent
     * Sessions the Server can support. The value specifies the
     * maximum the Server can support under normal circumstances,
     * therefore there is no guarantee the Server can always support
     * the maximum.
     */
    maxSessions: UInt32;
    /**
     * MaxSubscriptions is an integer specifying the maximum number of
     * Subscriptions the Server can support. The value specifies the
     * maximum the Server can support under normal circumstances,
     * therefore there is no guarantee the Server can always support
     * the maximum.
     */
    maxSubscriptions: UInt32;
    /**
     * MaxMonitoredItems is an integer specifying the maximum number of
     * MonitoredItems the Server can support. The value specifies the
     * maximum the Server can support under normal circumstances,
     * therefore there is no guarantee the Server can always support
     * the maximum.
     */
    maxMonitoredItems: UInt32;
    /**
     * MaxSubscriptionsPerSession is an integer specifying the maximum number of
     * Subscriptions per Session the Server can support. The value specifies the
     * maximum the Server can support under normal circumstances,
     * therefore there is no guarantee the Server can always support
     * the maximum.
     */
    maxSubscriptionsPerSession: UInt32;
    /**
     * MaxMonitoredItemsPerSubscription is an integer specifying the maximum number of
     * MonitoredItems per Subscription the Server can support. The value specifies the
     * maximum the Server can support under normal circumstances,
     * therefore there is no guarantee the Server can always support
     * the maximum
     */
    maxMonitoredItemsPerSubscription: UInt32;
    /**
     * MaxSelectClauseParameters is an integer specifying the maximum number of
     * EventField SelectClause Parameters the Server can support for an EventFilter.
     * The value specifies the maximum the Server can support under normal circumstances,
     * therefore there is no guarantee the Server can always support
     * the maximum.
     *
     * An EventFilter with more select clauses than this is refused with BadEventFilterInvalid.
     * Default 1000: a client that selects every field of every standard condition type
     * (what the OPC Foundation CTT's alarm collector does) sends 149 of them.
     */
    maxSelectClauseParameters: UInt32;
    /**
     * MaxWhereClauseParameters is an integer specifying the maximum number of
     * EventField WhereClause Parameters the Server can support for an EventFilter.
     * The value specifies the maximum the Server can support under normal circumstances,
     * therefore there is no guarantee the Server can always support the maximum
     *
     * Counted as the operands of every element of the whereClause; more than this is refused
     * with BadEventFilterInvalid. Default 1000: an alarm collector's "InList(ConditionId, ...)"
     * grows by one operand per condition it tracks.
     */
    maxWhereClauseParameters: UInt32;
    /**
     * (draft)
     * MaxMonitoredItemsQueueSize is an integer specifying the maximum size of MonitoredItem
     * queues. The value specifies the maximum the Server can support under normal circumstances,
     * therefore there is no guarantee the Server can always support the maximum.
     *
     */
    maxMonitoredItemsQueueSize: UInt32;
    /**
     *
     * ConformanceUnits is a QualifiedName array specifying the set of conformance units
     * the Server supports (Part 5, Server/ServerCapabilities/ConformanceUnits, i=24101,
     * new in OPC UA 1.05). Part 7 1.05 wants this list limited to the ConformanceUnits
     * the Server supports in its current configuration, e.g.
     * `[new QualifiedName({ name: "Base Info Core Structure 2" })]`.
     *
     * The variable reads the list live: assigning or pushing to
     * `server.engine.serverCapabilities.conformanceUnits` after the server has started
     * is reflected in the next Read. It is read-only for clients. Default: empty, which is
     * served as a typed empty QualifiedName array (not a Null variant).
     *
     */
    conformanceUnits: QualifiedName[];
}
export type ServerCapabilitiesOptions = Partial<IServerCapabilities>;
export declare const defaultServerCapabilities: IServerCapabilities;
/**
 */
export declare class ServerCapabilities implements IServerCapabilities {
    maxBrowseContinuationPoints: number;
    maxHistoryContinuationPoints: number;
    maxStringLength: number;
    maxArrayLength: number;
    maxByteStringLength: number;
    maxQueryContinuationPoints: number;
    minSupportedSampleRate: number;
    operationLimits: ServerOperationLimits;
    serverProfileArray: string[];
    localeIdArray: string[];
    softwareCertificates: SignedSoftwareCertificate[];
    maxSessions: UInt32;
    maxSubscriptions: UInt32;
    maxMonitoredItems: UInt32;
    maxSubscriptionsPerSession: UInt32;
    maxMonitoredItemsPerSubscription: UInt32;
    maxSelectClauseParameters: UInt32;
    maxWhereClauseParameters: UInt32;
    maxMonitoredItemsQueueSize: UInt32;
    conformanceUnits: QualifiedName[];
    constructor(options: ServerCapabilitiesOptions);
}
//# sourceMappingURL=server_capabilities.d.ts.map