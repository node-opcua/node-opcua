/**
 * @module node-opcua-server
 */
import type { Double, UInt32 } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import type { QualifiedName } from "node-opcua-data-model";
import { make_warningLog } from "node-opcua-debug";
import type { SignedSoftwareCertificate } from "node-opcua-types";

const warningLog = make_warningLog("server_capabilities");

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

export class ServerOperationLimits {
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

    // a limit left undefined takes the default; an explicit 0 means "no limit, not exposed"
    constructor(options: OperationLimitsOptions) {
        const d = defaultServerCapabilities.operationLimits as Required<OperationLimitsOptions>;
        this.maxNodesPerRead = options.maxNodesPerRead ?? d.maxNodesPerRead;
        this.maxNodesPerWrite = options.maxNodesPerWrite ?? d.maxNodesPerWrite;
        this.maxNodesPerMethodCall = options.maxNodesPerMethodCall ?? d.maxNodesPerMethodCall;
        this.maxNodesPerBrowse = options.maxNodesPerBrowse ?? d.maxNodesPerBrowse;
        this.maxNodesPerRegisterNodes = options.maxNodesPerRegisterNodes ?? d.maxNodesPerRegisterNodes;
        this.maxNodesPerNodeManagement = options.maxNodesPerNodeManagement ?? d.maxNodesPerNodeManagement;
        this.maxMonitoredItemsPerCall = options.maxMonitoredItemsPerCall ?? d.maxMonitoredItemsPerCall;
        this.maxNodesPerHistoryReadData = options.maxNodesPerHistoryReadData ?? d.maxNodesPerHistoryReadData;
        this.maxNodesPerHistoryReadEvents = options.maxNodesPerHistoryReadEvents ?? d.maxNodesPerHistoryReadEvents;
        this.maxNodesPerHistoryUpdateData = options.maxNodesPerHistoryUpdateData ?? d.maxNodesPerHistoryUpdateData;
        this.maxNodesPerHistoryUpdateEvents = options.maxNodesPerHistoryUpdateEvents ?? d.maxNodesPerHistoryUpdateEvents;
        this.maxNodesPerTranslateBrowsePathsToNodeIds =
            options.maxNodesPerTranslateBrowsePathsToNodeIds ?? d.maxNodesPerTranslateBrowsePathsToNodeIds;
    }
}

export interface IServerCapabilities {
    maxBrowseContinuationPoints: number;
    maxHistoryContinuationPoints: number;
    maxStringLength: number;
    maxArrayLength: number;
    maxByteStringLength: number;
    maxQueryContinuationPoints: number;
    minSupportedSampleRate: Double;
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

    // Part 5 OperationLimitsType: a limit that is exposed shall be non-zero, and the
    // server answers BadTooManyOperations past it. Every limit the server enforces gets
    // a real default; the three it does not enforce (history update, node management:
    // services it does not implement) stay at 0, which means "not exposed".
    operationLimits: {
        maxNodesPerBrowse: 1000,
        maxNodesPerHistoryReadData: 100,
        maxNodesPerHistoryReadEvents: 100,
        maxNodesPerHistoryUpdateData: 0,
        maxNodesPerHistoryUpdateEvents: 0,
        maxNodesPerMethodCall: 100,
        maxNodesPerNodeManagement: 0,
        maxNodesPerRead: 1000,
        maxNodesPerRegisterNodes: 1000,
        maxNodesPerWrite: 1000,
        maxNodesPerTranslateBrowsePathsToNodeIds: 1000,
        maxMonitoredItemsPerCall: 1000
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
    public operationLimits: ServerOperationLimits;

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

    constructor(options: ServerCapabilitiesOptions) {
        options = options || {};
        options.operationLimits = options.operationLimits || {};

        this.serverProfileArray = options.serverProfileArray || [];
        this.localeIdArray = options.localeIdArray || [];
        this.softwareCertificates = options.softwareCertificates || [];

        this.maxArrayLength = options.maxArrayLength || defaultServerCapabilities.maxArrayLength;

        // The generic array decoder refuses any array longer than BinaryStream.maxArrayLength.
        // Raise that ceiling to cover what this server advertises, so it never rejects an array a
        // client was told it may send. Only ever raised, never lowered, so configuring one server
        // cannot shrink a limit another already relies on.
        if (BinaryStream.maxArrayLength < this.maxArrayLength) {
            BinaryStream.maxArrayLength = this.maxArrayLength;
        }

        this.maxStringLength = options.maxStringLength || defaultServerCapabilities.maxStringLength;
        this.maxByteStringLength = options.maxByteStringLength || defaultServerCapabilities.maxByteStringLength;

        if (BinaryStream.maxStringLength < this.maxStringLength) {
            warningLog(
                `ServerCapabilities.maxStringLength ${this.maxStringLength} is greater that the allowed limite BinaryStream.maxStringLength = ${BinaryStream.maxStringLength}\nPlease adjust the value.`
            );
        }

        if (BinaryStream.maxByteStringLength < this.maxByteStringLength) {
            warningLog(
                `ServerCapabilities.maxByteStringLength ${this.maxByteStringLength} is greater that the allowed limite BinaryStream.maxByteStringLength = ${BinaryStream.maxByteStringLength}\nPlease adjust the value.`
            );
        }

        this.maxBrowseContinuationPoints =
            options.maxBrowseContinuationPoints || defaultServerCapabilities.maxBrowseContinuationPoints;
        this.maxQueryContinuationPoints =
            options.maxQueryContinuationPoints || defaultServerCapabilities.maxQueryContinuationPoints;
        this.maxHistoryContinuationPoints =
            options.maxHistoryContinuationPoints || defaultServerCapabilities.maxHistoryContinuationPoints;

        this.operationLimits = new ServerOperationLimits(options.operationLimits);

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
