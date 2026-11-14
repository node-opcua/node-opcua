import { BinaryStream } from "node-opcua-binary-stream";
import { make_warningLog } from "node-opcua-debug";
const warningLog = make_warningLog("server_capabilities");
export class ServerOperationLimits {
    maxNodesPerRead;
    maxNodesPerBrowse;
    maxNodesPerWrite;
    maxNodesPerMethodCall;
    maxNodesPerRegisterNodes;
    maxNodesPerNodeManagement;
    maxMonitoredItemsPerCall;
    maxNodesPerHistoryReadData;
    maxNodesPerHistoryReadEvents;
    maxNodesPerHistoryUpdateData;
    maxNodesPerHistoryUpdateEvents;
    maxNodesPerTranslateBrowsePathsToNodeIds;
    // a limit left undefined takes the default; an explicit 0 means "no limit, not exposed"
    constructor(options) {
        const d = defaultServerCapabilities.operationLimits;
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
export const defaultServerCapabilities = {
    maxBrowseContinuationPoints: 0,
    maxHistoryContinuationPoints: 0,
    maxStringLength: 16 * 1024 * 1024,
    maxArrayLength: 1024 * 1024,
    maxByteStringLength: 16 * 1024 * 1024,
    maxQueryContinuationPoints: 0,
    minSupportedSampleRate: 100,
    // Part 5 OperationLimitsType: a limit that is exposed shall be non-zero, and the
    // server answers BadTooManyOperations past it. Every limit the server enforces gets
    // a real default, generous enough for a client that monitors or reads a few
    // thousand nodes in one call (the CTT does, so does the crawler); the three limits
    // it does not enforce (history update, node management: services it does not
    // implement) stay at 0, which means "not exposed".
    operationLimits: {
        maxNodesPerBrowse: 10000,
        maxNodesPerHistoryReadData: 1000,
        maxNodesPerHistoryReadEvents: 1000,
        maxNodesPerHistoryUpdateData: 0,
        maxNodesPerHistoryUpdateEvents: 0,
        maxNodesPerMethodCall: 1000,
        maxNodesPerNodeManagement: 0,
        maxNodesPerRead: 10000,
        maxNodesPerRegisterNodes: 10000,
        maxNodesPerWrite: 10000,
        maxNodesPerTranslateBrowsePathsToNodeIds: 10000,
        maxMonitoredItemsPerCall: 10000
    },
    serverProfileArray: [],
    localeIdArray: [],
    softwareCertificates: [],
    maxSessions: 10,
    maxSubscriptions: 100,
    maxMonitoredItems: 1000000, // 1 million
    maxSubscriptionsPerSession: 10,
    maxMonitoredItemsPerSubscription: 100000, // one hundred thousand
    // 100 was below what any server exposing the standard alarm types receives from a client
    // that selects every event field (the CTT's alarm collector: 149 select clauses over the
    // 33 standard condition types), and its where clause grows with the conditions tracked.
    maxSelectClauseParameters: 1000,
    maxWhereClauseParameters: 1000,
    maxMonitoredItemsQueueSize: 60000,
    conformanceUnits: []
};
/**
 */
export class ServerCapabilities {
    maxBrowseContinuationPoints;
    maxHistoryContinuationPoints;
    maxStringLength;
    maxArrayLength;
    maxByteStringLength;
    maxQueryContinuationPoints;
    minSupportedSampleRate;
    operationLimits;
    serverProfileArray;
    localeIdArray;
    softwareCertificates;
    // new in 1.05
    maxSessions;
    maxSubscriptions;
    maxMonitoredItems;
    maxSubscriptionsPerSession;
    maxMonitoredItemsPerSubscription;
    maxSelectClauseParameters;
    maxWhereClauseParameters;
    maxMonitoredItemsQueueSize;
    conformanceUnits;
    constructor(options) {
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
            warningLog(`ServerCapabilities.maxStringLength ${this.maxStringLength} is greater that the allowed limite BinaryStream.maxStringLength = ${BinaryStream.maxStringLength}\nPlease adjust the value.`);
        }
        if (BinaryStream.maxByteStringLength < this.maxByteStringLength) {
            warningLog(`ServerCapabilities.maxByteStringLength ${this.maxByteStringLength} is greater that the allowed limite BinaryStream.maxByteStringLength = ${BinaryStream.maxByteStringLength}\nPlease adjust the value.`);
        }
        this.maxBrowseContinuationPoints =
            options.maxBrowseContinuationPoints || defaultServerCapabilities.maxBrowseContinuationPoints;
        this.maxQueryContinuationPoints =
            options.maxQueryContinuationPoints || defaultServerCapabilities.maxQueryContinuationPoints;
        this.maxHistoryContinuationPoints =
            options.maxHistoryContinuationPoints || defaultServerCapabilities.maxHistoryContinuationPoints;
        this.operationLimits = new ServerOperationLimits(options.operationLimits);
        this.minSupportedSampleRate = options.minSupportedSampleRate ?? defaultServerCapabilities.minSupportedSampleRate;
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
        // a copy: the default is a shared array and the list is meant to be edited after start
        this.conformanceUnits = [...(options.conformanceUnits || defaultServerCapabilities.conformanceUnits)];
    }
}
//# sourceMappingURL=server_capabilities.js.map