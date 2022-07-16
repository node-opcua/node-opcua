/**
 * @module node-opcua-server
 */
// tslint:disable:max-classes-per-file
import { UInt32 } from "node-opcua-basic-types";
import { QualifiedName } from "node-opcua-data-model";
import { SignedSoftwareCertificate } from "node-opcua-types";
import { OPCUAServer } from "./opcua_server";

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
        this.maxNodesPerRead = options.maxNodesPerRead || 0;
        this.maxNodesPerWrite = options.maxNodesPerWrite || 0;
        this.maxNodesPerMethodCall = options.maxNodesPerMethodCall || 0;
        this.maxNodesPerBrowse = options.maxNodesPerBrowse || 0;
        this.maxNodesPerRegisterNodes = options.maxNodesPerRegisterNodes || 0;
        this.maxNodesPerNodeManagement = options.maxNodesPerNodeManagement || 0;
        this.maxMonitoredItemsPerCall = options.maxMonitoredItemsPerCall || 0;
        this.maxNodesPerHistoryReadData = options.maxNodesPerHistoryReadData || 0;
        this.maxNodesPerHistoryReadEvents = options.maxNodesPerHistoryReadEvents || 0;
        this.maxNodesPerHistoryUpdateData = options.maxNodesPerHistoryUpdateData || 0;
        this.maxNodesPerHistoryUpdateEvents = options.maxNodesPerHistoryUpdateEvents || 0;
        this.maxNodesPerTranslateBrowsePathsToNodeIds = options.maxNodesPerTranslateBrowsePathsToNodeIds || 0;
    }
}

export interface IServerCapabilities {
    maxBrowseContinuationPoints: number;
    maxHistoryContinuationPoints: number;
    maxStringLength: number;
    maxArrayLength: number;
    maxByteStringLength: number;
    maxQueryContinuationPoints: number;
    minSupportedSampleRate: number;
    operationLimits: OperationLimitsOptions;

    serverProfileArray: string[];
    localeIdArray: string[];
    softwareCertificates: SignedSoftwareCertificate[];

    // new in 1.05
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
     */
    maxSelectClauseParameters: UInt32;

    /**
     * MaxWhereClauseParameters is an integer specifying the maximum number of
     * EventField WhereClause Parameters the Server can support for an EventFilter.
     * The value specifies the maximum the Server can support under normal circumstances,
     * therefore there is no guarantee the Server can always support the maximum
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
     * the Server supports. This list should be limited to the ConformanceUnits the Server
     * supports in its current configuration.
     *
     */
    conformanceUnits: QualifiedName[];
}
export type ServerCapabilitiesOptions = Partial<IServerCapabilities>;

export const defaultServerCapabilities: IServerCapabilities = {
    maxBrowseContinuationPoints: 0,
    maxHistoryContinuationPoints: 0,
    maxStringLength: 16 * 1024 * 1024,
    maxArrayLength: 1024 * 1024,
    maxByteStringLength: 16 * 1024 * 1024,
    maxQueryContinuationPoints: 0,

    minSupportedSampleRate: 100,

    operationLimits: {
        maxNodesPerBrowse: 0,
        maxNodesPerHistoryReadData: 0,
        maxNodesPerHistoryReadEvents: 0,
        maxNodesPerHistoryUpdateData: 0,
        maxNodesPerHistoryUpdateEvents: 0,
        maxNodesPerMethodCall: 0,
        maxNodesPerNodeManagement: 0,
        maxNodesPerRead: 0,
        maxNodesPerRegisterNodes: 0,
        maxNodesPerWrite: 0,
        maxNodesPerTranslateBrowsePathsToNodeIds: 0,
        maxMonitoredItemsPerCall: 0
    },

    serverProfileArray: [],
    localeIdArray: [],
    softwareCertificates: [],

    maxSessions: 10,
    maxSubscriptions: 100,
    maxMonitoredItems: 1000000, // 1 million
    maxSubscriptionsPerSession: 10,
    maxMonitoredItemsPerSubscription: 100000, // one hundred thousand
    maxSelectClauseParameters: 100,
    maxWhereClauseParameters: 100,
    maxMonitoredItemsQueueSize: 60000,

    conformanceUnits: []
};

/**
 */
export class ServerCapabilities implements IServerCapabilities {
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
    public maxSessions: UInt32;
    public maxSubscriptions: UInt32;
    public maxMonitoredItems: UInt32;
    public maxSubscriptionsPerSession: UInt32;
    public maxMonitoredItemsPerSubscription: UInt32;
    public maxSelectClauseParameters: UInt32;
    public maxWhereClauseParameters: UInt32;
    public maxMonitoredItemsQueueSize: UInt32;
    public conformanceUnits: QualifiedName[];

    // eslint-disable-next-line complexity
    constructor(options: ServerCapabilitiesOptions) {
        options = options || {};
        options.operationLimits = options.operationLimits || {};

        this.serverProfileArray = options.serverProfileArray || [];
        this.localeIdArray = options.localeIdArray || [];
        this.softwareCertificates = options.softwareCertificates || [];

        this.maxArrayLength = options.maxArrayLength || defaultServerCapabilities.maxArrayLength;
        this.maxStringLength = options.maxStringLength || defaultServerCapabilities.maxStringLength;
        this.maxByteStringLength = options.maxByteStringLength || defaultServerCapabilities.maxByteStringLength;
        this.maxBrowseContinuationPoints =
            options.maxBrowseContinuationPoints || defaultServerCapabilities.maxBrowseContinuationPoints;
        this.maxQueryContinuationPoints =
            options.maxQueryContinuationPoints || defaultServerCapabilities.maxQueryContinuationPoints;
        this.maxHistoryContinuationPoints =
            options.maxHistoryContinuationPoints || defaultServerCapabilities.maxHistoryContinuationPoints;

        this.operationLimits = new OperationLimits(options.operationLimits);

        this.minSupportedSampleRate = options.minSupportedSampleRate || defaultServerCapabilities.minSupportedSampleRate; // to do adjust me

        // new in 1.05
        this.maxSessions = options.maxSessions || defaultServerCapabilities.maxSessions;

        this.maxSubscriptionsPerSession =
            options.maxSubscriptionsPerSession || defaultServerCapabilities.maxSubscriptionsPerSession;
        this.maxSubscriptions = options.maxSubscriptions || defaultServerCapabilities.maxSubscriptions;
        this.maxMonitoredItems = options.maxMonitoredItems || defaultServerCapabilities.maxMonitoredItems;
        this.maxMonitoredItemsPerSubscription =
            options.maxMonitoredItemsPerSubscription || defaultServerCapabilities.maxMonitoredItemsPerSubscription;
        this.maxSelectClauseParameters = options.maxSelectClauseParameters || defaultServerCapabilities.maxSelectClauseParameters;
        this.maxWhereClauseParameters = options.maxWhereClauseParameters || defaultServerCapabilities.maxWhereClauseParameters;
        this.maxMonitoredItemsQueueSize =
            options.maxMonitoredItemsQueueSize || defaultServerCapabilities.maxMonitoredItemsQueueSize;
        this.conformanceUnits = options.conformanceUnits || defaultServerCapabilities.conformanceUnits;
    }
}
