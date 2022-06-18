/**
 * @module node-opcua-server
 */
// tslint:disable:max-classes-per-file
import { UInt32 } from "node-opcua-basic-types";
import { Certificate } from "node-opcua-crypto";
import { QualifiedName } from "node-opcua-data-model";
import { SignedSoftwareCertificate } from "node-opcua-types";

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

export class OperationLimits {
    public maxNodesPerRead: number;
    public maxNodesPerBrowse: number;
    public maxNodesPerWrite: number;
    public maxNodesPerMethodCall: number;
    public maxNodesPerRegisterNodes: number;
    public maxNodesPerNodeManagement: number;
    public maxMonitoredItemsPerCall: number;
    public maxNodesPerHistoryReadData: number;
    public maxNodesPerHistoryReadEvents: number;
    public maxNodesPerHistoryUpdateData: number;
    public maxNodesPerHistoryUpdateEvents: number;
    public maxNodesPerTranslateBrowsePathsToNodeIds: number;

    constructor(options: OperationLimitsOptions) {
        /**
         * @property maxNodesPerRead
         * @default 0
         */
        this.maxNodesPerRead = options.maxNodesPerRead || 0;
        /**
         * @property maxNodesPerWrite
         * @default 0
         */
        this.maxNodesPerWrite = options.maxNodesPerWrite || 0;
        /**
         * @property maxNodesPerMethodCall
         * @default 0
         */
        this.maxNodesPerMethodCall = options.maxNodesPerMethodCall || 0;
        /**
         * @property maxNodesPerBrowse
         * @default 0
         */
        this.maxNodesPerBrowse = options.maxNodesPerBrowse || 0;
        /**
         * @property maxNodesPerRegisterNodes
         * @default 0
         */
        this.maxNodesPerRegisterNodes = options.maxNodesPerRegisterNodes || 0;
        /**
         * @property maxNodesPerNodeManagement
         * @default 0
         */
        this.maxNodesPerNodeManagement = options.maxNodesPerNodeManagement || 0;
        /**
         * @property maxMonitoredItemsPerCall
         * @default 0
         */
        this.maxMonitoredItemsPerCall = options.maxMonitoredItemsPerCall || 0;
        /**
         * @property maxNodesPerHistoryReadData
         */
        this.maxNodesPerHistoryReadData = options.maxNodesPerHistoryReadData || 0;
        /**
         * @property maxNodesPerHistoryReadEvents
         * @default 0
         */
        this.maxNodesPerHistoryReadEvents = options.maxNodesPerHistoryReadEvents || 0;
        /**
         * @property maxNodesPerHistoryUpdateData
         * @default 0
         */
        this.maxNodesPerHistoryUpdateData = options.maxNodesPerHistoryUpdateData || 0;
        /**
         * @property maxNodesPerHistoryUpdateEvents
         * @default 0
         */
        this.maxNodesPerHistoryUpdateEvents = options.maxNodesPerHistoryUpdateEvents || 0;
        /**
         * @property maxNodesPerTranslateBrowsePathsToNodeIds
         * @default 0
         */
        this.maxNodesPerTranslateBrowsePathsToNodeIds = options.maxNodesPerTranslateBrowsePathsToNodeIds || 0;
    }
}

export interface ServerCapabilitiesOptions {
    maxBrowseContinuationPoints?: number;
    maxHistoryContinuationPoints?: number;
    maxStringLength?: number;
    maxArrayLength?: number;
    maxByteStringLength?: number;
    maxQueryContinuationPoints?: number;
    minSupportedSampleRate?: number;
    operationLimits?: OperationLimitsOptions;

    serverProfileArray?: string[];
    localeIdArray?: string[];
    softwareCertificates?: SignedSoftwareCertificate[];
}

/**
 */
export class ServerCapabilities {
    public maxBrowseContinuationPoints: number;
    public maxHistoryContinuationPoints: number;
    public maxStringLength: number;
    public maxArrayLength: number;
    public maxByteStringLength: number;
    public maxQueryContinuationPoints: number;
    public minSupportedSampleRate: number;
    public operationLimits: OperationLimits;

    public serverProfileArray: string[];
    public localeIdArray: string[];
    public softwareCertificates: SignedSoftwareCertificate[];

    // new in 1.05
    /**
     * MaxSessions is an integer specifying the maximum number of concurrent
     * Sessions the Server can support. The value specifies the
     * maximum the Server can support under normal circumstances,
     * therefore there is no guarantee the Server can always support
     * the maximum.
     */
    public maxSessions: UInt32 = 0;
    /**
     * MaxSubscriptions is an integer specifying the maximum number of
     * Subscriptions the Server can support. The value specifies the
     * maximum the Server can support under normal circumstances,
     * therefore there is no guarantee the Server can always support
     * the maximum.
     */
    public maxSubscriptions: UInt32 = 0;
    /**
     * MaxMonitoredItems is an integer specifying the maximum number of
     * MonitoredItems the Server can support. The value specifies the
     * maximum the Server can support under normal circumstances,
     * therefore there is no guarantee the Server can always support
     * the maximum.
     */
    public maxMonitoredItems: UInt32 = 0;
    /**
     * MaxSubscriptionsPerSession is an integer specifying the maximum number of
     * Subscriptions per Session the Server can support. The value specifies the
     * maximum the Server can support under normal circumstances,
     * therefore there is no guarantee the Server can always support
     * the maximum.
     */
    public maxSubscriptionPerSession: UInt32 = 0;
    /**
     * MaxMonitoredItemsPerSubscription is an integer specifying the maximum number of
     * MonitoredItems per Subscription the Server can support. The value specifies the
     * maximum the Server can support under normal circumstances,
     * therefore there is no guarantee the Server can always support
     * the maximum
     */
    public maxMonitoredItemsPerSubscription: UInt32 = 0;
    /**
     * MaxSelectClauseParameters is an integer specifying the maximum number of
     * EventField SelectClause Parameters the Server can support for an EventFilter.
     * The value specifies the maximum the Server can support under normal circumstances,
     * therefore there is no guarantee the Server can always support
     * the maximum.
     */
    public maxSelectClauseParameters: UInt32 = 0;
    /**
     * MaxWhereClauseParameters is an integer specifying the maximum number of
     * EventField WhereClause Parameters the Server can support for an EventFilter.
     * The value specifies the maximum the Server can support under normal circumstances,
     * therefore there is no guarantee the Server can always support the maximum
     */
    public maxWhereClauseParameters: UInt32 = 0;

    /**
     * (draft)
     * MaxMonitoredItemsQueueSize is an integer specifying the maximum size of MonitoredItem
     * queues. The value specifies the maximum the Server can support under normal circumstances,
     * therefore there is no guarantee the Server can always support the maximum.
     *
     */
    public maxMonitoredItemsQueueSize: UInt32 = 0;

    /**
     *
     * ConformanceUnits is a QualifiedName array specifying the set of conformance units 
     * the Server supports. This list should be limited to the ConformanceUnits the Server 
     * supports in its current configuration.
     *
     */
    public conformanceUnits: QualifiedName[] = [];

    constructor(options: ServerCapabilitiesOptions) {
        options = options || {};
        options.operationLimits = options.operationLimits || {};
        this.serverProfileArray = options.serverProfileArray || [];
        this.localeIdArray = options.localeIdArray || [];
        this.softwareCertificates = options.softwareCertificates || [];
        this.maxArrayLength = options.maxArrayLength || 0;
        this.maxStringLength = options.maxStringLength || 0;
        this.maxByteStringLength = options.maxByteStringLength || 0;
        this.maxBrowseContinuationPoints = options.maxBrowseContinuationPoints || 0;
        this.maxQueryContinuationPoints = options.maxQueryContinuationPoints || 0;
        this.maxHistoryContinuationPoints = options.maxHistoryContinuationPoints || 0;
        this.operationLimits = new OperationLimits(options.operationLimits);

        this.minSupportedSampleRate = 100; // to do adjust me
    }
}
