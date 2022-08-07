/**
 * @module node-opcua-server
 */
import { EventEmitter } from "events";
import * as async from "async";
import * as chalk from "chalk";
import { assert } from "node-opcua-assert";
import { BinaryStream} from "node-opcua-binary-stream";
import {
    addElement,
    AddressSpace,
    BaseNode,
    bindExtObjArrayNode,
    ensureDatatypeExtractedWithCallback,
    ensureObjectIsSecure,
    MethodFunctor,
    removeElement,
    SessionContext,
    UADataType,
    UADynamicVariableArray,
    UAMethod,
    UAObject,
    UAServerDiagnosticsSummary,
    UAServerStatus,
    UAVariable,
    UAServerDiagnostics,
    BindVariableOptions,
    ISessionContext,
    DTServerStatus,
    resolveOpaqueOnAddressSpace,
    ContinuationData,
    UARole
} from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { DataValue, coerceTimestampsToReturn, apply_timestamps_no_copy } from "node-opcua-data-value";
import {
    ServerDiagnosticsSummaryDataType,
    ServerState,
    ServerStatusDataType,
    SubscriptionDiagnosticsDataType
} from "node-opcua-common";
import {
    AttributeIds,
    BrowseDirection,
    coerceLocalizedText,
    LocalizedTextLike,
    makeAccessLevelFlag,
    NodeClass,
    QualifiedName
} from "node-opcua-data-model";
import { coerceNodeId, makeNodeId, NodeId, NodeIdLike, NodeIdType, resolveNodeId } from "node-opcua-nodeid";
import { BrowseResult } from "node-opcua-service-browse";
import { ReadRequest, TimestampsToReturn } from "node-opcua-service-read";
import { UInt32 } from "node-opcua-basic-types";
import { CreateSubscriptionRequestLike } from "node-opcua-client";
import { ExtraDataTypeManager } from "node-opcua-client-dynamic-extension-object";
import { DataTypeIds, MethodIds, ObjectIds, VariableIds } from "node-opcua-constants";
import { getCurrentClock, minOPCUADate } from "node-opcua-date-time";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog, traceFromThisProjectOnly } from "node-opcua-debug";
import { nodesets } from "node-opcua-nodesets";
import { NumericRange } from "node-opcua-numeric-range";
import { ObjectRegistry } from "node-opcua-object-registry";
import { CallMethodResult } from "node-opcua-service-call";
import { TransferResult } from "node-opcua-service-subscription";
import { ApplicationDescription } from "node-opcua-service-endpoints";
import { HistoryReadDetails, HistoryReadRequest, HistoryReadResult, HistoryReadValueId } from "node-opcua-service-history";
import { StatusCode, StatusCodes, CallbackT, StatusCodeCallback } from "node-opcua-status-code";
import {
    BrowseDescription,
    BrowsePath,
    BrowsePathResult,
    BuildInfo,
    BuildInfoOptions,
    ReadAtTimeDetails,
    ReadEventDetails,
    ReadProcessedDetails,
    ReadRawModifiedDetails,
    SessionDiagnosticsDataType,
    SessionSecurityDiagnosticsDataType,
    WriteValue,
    ReadValueId,
    TimeZoneDataType,
    ProgramDiagnosticDataType,
    CallMethodResultOptions
} from "node-opcua-types";
import { DataType, isValidVariant, Variant, VariantArrayType } from "node-opcua-variant";

import { HistoryServerCapabilities, HistoryServerCapabilitiesOptions } from "./history_server_capabilities";
import { MonitoredItem } from "./monitored_item";
import { OperationLimits, ServerCapabilities, ServerCapabilitiesOptions } from "./server_capabilities";
import { ServerSidePublishEngine } from "./server_publish_engine";
import { ServerSidePublishEngineForOrphanSubscription } from "./server_publish_engine_for_orphan_subscriptions";
import { ServerSession } from "./server_session";
import { Subscription } from "./server_subscription";
import { sessionsCompatibleForTransfer } from "./sessions_compatible_for_transfer";
import { OPCUAServerOptions } from "./opcua_server";

const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const warningLog = make_warningLog(__filename);
const doDebug = checkDebugFlag(__filename);

function upperCaseFirst(str: string) {
    return str.slice(0, 1).toUpperCase() + str.slice(1);
}

async function shutdownAndDisposeAddressSpace(this: ServerEngine) {
    if (this.addressSpace) {
        await this.addressSpace.shutdown();
        this.addressSpace.dispose();
        delete (this as any).addressSpace;
    }
}

function setSubscriptionDurable(
    this: ServerEngine,
    inputArguments: Variant[],
    context: ISessionContext,
    callback: CallbackT<CallMethodResultOptions>
) {
    // see https://reference.opcfoundation.org/v104/Core/docs/Part5/9.3/
    // https://reference.opcfoundation.org/v104/Core/docs/Part4/6.8/
    assert(Array.isArray(inputArguments));
    assert(typeof callback === "function");
    assert(Object.prototype.hasOwnProperty.call(context, "session"), " expecting a session id in the context object");
    const session = context.session as ServerSession;
    if (!session) {
        return callback(null, { statusCode: StatusCodes.BadInternalError });
    }
    const subscriptionId = inputArguments[0].value as UInt32;
    const lifetimeInHours = inputArguments[1].value as UInt32;

    const subscription = session.getSubscription(subscriptionId);
    if (!subscription) {
        // subscription may belongs to a different session  that ours
        if (this.findSubscription(subscriptionId)) {
            // if yes, then access to  Subscription data should be denied
            return callback(null, { statusCode: StatusCodes.BadUserAccessDenied });
        }
        return callback(null, { statusCode: StatusCodes.BadSubscriptionIdInvalid });
    }
    if (subscription.monitoredItemCount > 0) {
        // This is returned when a Subscription already contains MonitoredItems.
        return callback(null, { statusCode: StatusCodes.BadInvalidState });
    }

    /**
     * MonitoredItems are used to monitor Variable Values for data changes and event notifier
     * Objects for new Events. Subscriptions are used to combine data changes and events of
     * the assigned MonitoredItems to an optimized stream of network messages. A reliable
     * delivery is ensured as long as the lifetime of the Subscription and the queues in the
     * MonitoredItems are long enough for a network interruption between OPC UA Client and
     * Server. All queues that ensure reliable delivery are normally kept in memory and a
     * Server restart would delete them.
     * There are use cases where OPC UA Clients have no permanent network connection to the
     * OPC UA Server or where reliable delivery of data changes and events is necessary
     * even if the OPC UA Server is restarted or the network connection is interrupted
     * for a longer time.
     * To ensure this reliable delivery, the OPC UA Server must store collected data and
     * events in non-volatile memory until the OPC UA Client has confirmed reception.
     * It is possible that there will be data lost if the Server is not shut down gracefully
     * or in case of power failure. But the OPC UA Server should store the queues frequently
     * even if the Server is not shut down.
     * The Method SetSubscriptionDurable defined in OPC 10000-5 is used to set a Subscription
     * into this durable mode and to allow much longer lifetimes and queue sizes than for normal
     * Subscriptions. The Method shall be called before the MonitoredItems are created in the
     * durable Subscription. The Server shall verify that the Method is called within the
     * Session context of the Session that owns the Subscription.
     *
     * A value of 0 for the parameter lifetimeInHours requests the highest lifetime supported by the Server.
     */

    const highestLifetimeInHours = 24 * 100;

    const revisedLifetimeInHours =
        lifetimeInHours === 0 ? highestLifetimeInHours : Math.max(1, Math.min(lifetimeInHours, highestLifetimeInHours));

    // also adjust subscription life time
    const currentLifeTimeInHours = (subscription.lifeTimeCount * subscription.publishingInterval) / (1000 * 60 * 60);
    if (currentLifeTimeInHours < revisedLifetimeInHours) {
        const requestedLifetimeCount = Math.ceil((revisedLifetimeInHours * (1000 * 60 * 60)) / subscription.publishingInterval);

        subscription.modify({
            requestedMaxKeepAliveCount: subscription.maxKeepAliveCount,
            requestedPublishingInterval: subscription.publishingInterval,
            maxNotificationsPerPublish: subscription.maxNotificationsPerPublish,
            priority: subscription.priority,
            requestedLifetimeCount
        });
    }

    const callMethodResult = new CallMethodResult({
        statusCode: StatusCodes.Good,
        outputArguments: [{ dataType: DataType.UInt32, arrayType: VariantArrayType.Scalar, value: revisedLifetimeInHours }]
    });
    callback(null, callMethodResult);
}

// binding methods
function getMonitoredItemsId(
    this: ServerEngine,
    inputArguments: Variant[],
    context: ISessionContext,
    callback: CallbackT<CallMethodResultOptions>
) {
    assert(Array.isArray(inputArguments));
    assert(typeof callback === "function");
    assert(Object.prototype.hasOwnProperty.call(context, "session"), " expecting a session id in the context object");

    const session = context.session as ServerSession;
    if (!session) {
        return callback(null, { statusCode: StatusCodes.BadInternalError });
    }

    const subscriptionId = inputArguments[0].value;
    const subscription = session.getSubscription(subscriptionId);
    if (!subscription) {
        // subscription may belongs to a different session  that ours
        if (this.findSubscription(subscriptionId)) {
            // if yes, then access to  Subscription data should be denied
            return callback(null, { statusCode: StatusCodes.BadUserAccessDenied });
        }

        return callback(null, { statusCode: StatusCodes.BadSubscriptionIdInvalid });
    }
    const result = subscription.getMonitoredItems();
    assert(result.statusCode);
    assert(result.serverHandles.length === result.clientHandles.length);
    const callMethodResult = new CallMethodResult({
        statusCode: result.statusCode,
        outputArguments: [
            { dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: result.serverHandles },
            { dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: result.clientHandles }
        ]
    });
    callback(null, callMethodResult);
}

function __bindVariable(self: ServerEngine, nodeId: NodeIdLike, options?: BindVariableOptions) {
    options = options || {};

    const variable = self.addressSpace!.findNode(nodeId) as UAVariable;
    if (variable && variable.bindVariable) {
        variable.bindVariable(options, true);
        assert(typeof variable.asyncRefresh === "function");
        assert(typeof (variable as any).refreshFunc === "function");
    } else {
        warningLog(
            "Warning: cannot bind object with id ",
            nodeId.toString(),
            " please check your nodeset.xml file or add this node programmatically"
        );
    }
}

// note OPCUA 1.03 part 4 page 76
// The Server-assigned identifier for the Subscription (see 7.14 for IntegerId definition). This identifier shall
// be unique for the entire Server, not just for the Session, in order to allow the Subscription to be transferred
// to another Session using the TransferSubscriptions service.
// After Server start-up the generation of subscriptionIds should start from a random IntegerId or continue from
// the point before the restart.
let next_subscriptionId = Math.ceil(Math.random() * 1000000);

function _get_next_subscriptionId() {
    debugLog(" next_subscriptionId = ", next_subscriptionId);
    return next_subscriptionId++;
}

export type StringGetter = () => string;

export interface ServerEngineOptions {
    applicationUri: string | StringGetter;

    buildInfo?: BuildInfoOptions;
    isAuditing?: boolean;
    /**
     * set to true to enable serverDiagnostics
     */
    serverDiagnosticsEnabled?: boolean;
    serverCapabilities?: ServerCapabilitiesOptions;
    historyServerCapabilities?: HistoryServerCapabilitiesOptions;
}

export interface CreateSessionOption {
    clientDescription?: ApplicationDescription;
    sessionTimeout?: number;
}

export type ClosingReason = "Timeout" | "Terminated" | "CloseSession" | "Forcing";

export type ShutdownTask = (this: ServerEngine) => void | Promise<void>;
/**
 *
 */
export class ServerEngine extends EventEmitter {
    public static readonly registry = new ObjectRegistry();

    public isAuditing: boolean;
    public serverDiagnosticsSummary: ServerDiagnosticsSummaryDataType;
    public serverDiagnosticsEnabled: boolean;
    public serverCapabilities: ServerCapabilities;
    public historyServerCapabilities: HistoryServerCapabilities;
    public clientDescription?: ApplicationDescription;

    public addressSpace: AddressSpace | null;

    // pseudo private
    public _internalState: "creating" | "initializing" | "initialized" | "shutdown" | "disposed";

    private _sessions: { [key: string]: ServerSession };
    private _closedSessions: { [key: string]: ServerSession };
    private _orphanPublishEngine?: ServerSidePublishEngineForOrphanSubscription;
    private _shutdownTasks: ShutdownTask[];
    private _applicationUri: string;
    private _expectedShutdownTime!: Date;
    private _serverStatus: ServerStatusDataType;
    private _globalCounter: { totalMonitoredItemCount: number } = { totalMonitoredItemCount: 0 };

    constructor(options: ServerEngineOptions) {
        super();

        options = options || ({ applicationUri: "" } as ServerEngineOptions);
        options.buildInfo = options.buildInfo || {};

        ServerEngine.registry.register(this);

        this._sessions = {};
        this._closedSessions = {};
        this._orphanPublishEngine = undefined; // will be constructed on demand

        this.isAuditing = typeof options.isAuditing === "boolean" ? options.isAuditing : false;

        options.buildInfo.buildDate = options.buildInfo.buildDate || new Date();
        // ---------------------------------------------------- ServerStatusDataType
        this._serverStatus = new ServerStatusDataType({
            buildInfo: options.buildInfo,
            currentTime: new Date(),
            secondsTillShutdown: 0,
            shutdownReason: { text: "" },
            startTime: new Date(),
            state: ServerState.NoConfiguration
        });

        // --------------------------------------------------- ServerCapabilities
        options.serverCapabilities = options.serverCapabilities || {};

        // https://profiles.opcfoundation.org/profile
        options.serverCapabilities.serverProfileArray = options.serverCapabilities.serverProfileArray || [
            "http://opcfoundation.org/UA-Profile/Server/Standard", // Standard UA Server Profile",
            "http://opcfoundation.org/UA-Profile/Server/DataAccess",
            "http://opcfoundation.org/UA-Profile/Server/Events",
            "http://opcfoundation.org/UA-Profile/Client/HistoricalAccess",
            "http://opcfoundation.org/UA-Profile/Server/Methods",
            "http://opcfoundation.org/UA-Profile/Server/StandardEventSubscription",
            "http://opcfoundation.org/UA-Profile/Transport/uatcp-uasc-uabinary",
            "http://opcfoundation.org/UA-Profile/Server/FileAccess",
            "http://opcfoundation.org/UA-Profile/Server/StateMachine"
            // "http://opcfoundation.org/UA-Profile/Transport/wss-uajson",
            // "http://opcfoundation.org/UA-Profile/Transport/wss-uasc-uabinary"
            // "http://opcfoundation.org/UA-Profile/Server/DurableSubscription"

            // "http://opcfoundation.org/UA-Profile/Server/ReverseConnect",
            // "http://opcfoundation.org/UAProfile/Server/NodeManagement",

            //  "Embedded UA Server Profile",
            // "Micro Embedded Device Server Profile",
            // "Nano Embedded Device Server Profile"
        ];
        options.serverCapabilities.localeIdArray = options.serverCapabilities.localeIdArray || ["en-EN", "fr-FR"];

        this.serverCapabilities = new ServerCapabilities(options.serverCapabilities);

        // to do when spec is clear about what goes here!
        // spec 1.04 says (in Part 4 7.33 SignedSoftwareCertificate
        // Note: Details on SoftwareCertificates need to be defined in a future version.
        this.serverCapabilities.softwareCertificates = [
            // new SignedSoftwareCertificate({})
        ];

        // make sure minSupportedSampleRate matches MonitoredItem.minimumSamplingInterval
        (this.serverCapabilities as any).__defineGetter__("minSupportedSampleRate", () => {
            return MonitoredItem.minimumSamplingInterval;
        });

        this.historyServerCapabilities = new HistoryServerCapabilities(options.historyServerCapabilities);

        // --------------------------------------------------- serverDiagnosticsSummary extension Object
        this.serverDiagnosticsSummary = new ServerDiagnosticsSummaryDataType();
        assert(Object.prototype.hasOwnProperty.call(this.serverDiagnosticsSummary, "currentSessionCount"));

        // note spelling is different for serverDiagnosticsSummary.currentSubscriptionCount
        //      and sessionDiagnostics.currentSubscriptionsCount ( with an s)
        assert(Object.prototype.hasOwnProperty.call(this.serverDiagnosticsSummary, "currentSubscriptionCount"));

        (this.serverDiagnosticsSummary as any).__defineGetter__("currentSubscriptionCount", () => {
            // currentSubscriptionCount returns the total number of subscriptions
            // that are currently active on all sessions
            let counter = 0;
            Object.values(this._sessions).forEach((session: ServerSession) => {
                counter += session.currentSubscriptionCount;
            });
            // we also need to add the orphan subscriptions
            counter += this._orphanPublishEngine ? this._orphanPublishEngine .subscriptions.length : 0;
            return counter;
        });

        this._internalState = "creating";

        this.setServerState(ServerState.NoConfiguration);

        this.addressSpace = null;

        this._shutdownTasks = [];

        this._applicationUri = "";
        if (typeof options.applicationUri === "function") {
            (this as any).__defineGetter__("_applicationUri", options.applicationUri);
        } else {
            this._applicationUri = options.applicationUri || "<unset _applicationUri>";
        }

        options.serverDiagnosticsEnabled = Object.prototype.hasOwnProperty.call(options, "serverDiagnosticsEnable")
            ? options.serverDiagnosticsEnabled
            : true;

        this.serverDiagnosticsEnabled = options.serverDiagnosticsEnabled!;
    }
    public isStarted(): boolean {
        return !!this._serverStatus!;
    }

    public dispose(): void {
        this.addressSpace = null;

        assert(Object.keys(this._sessions).length === 0, "ServerEngine#_sessions not empty");
        this._sessions = {};

        // todo fix me
        this._closedSessions = {};
        assert(Object.keys(this._closedSessions).length === 0, "ServerEngine#_closedSessions not empty");
        this._closedSessions = {};

        if (this._orphanPublishEngine) {
            this._orphanPublishEngine.dispose();
            this._orphanPublishEngine = undefined;
        }

        this._shutdownTasks = [];
        this._serverStatus = null as any as ServerStatusDataType;
        this._internalState = "disposed";
        this.removeAllListeners();

        ServerEngine.registry.unregister(this);
    }

    public get startTime(): Date {
        return this._serverStatus.startTime!;
    }

    public get currentTime(): Date {
        return this._serverStatus.currentTime!;
    }

    public get buildInfo(): BuildInfo {
        return this._serverStatus.buildInfo;
    }

    /**
     * register a function that will be called when the server will perform its shut down.
     * @method registerShutdownTask
     */
    public registerShutdownTask(task: (this: ServerEngine) => void): void {
        assert(typeof task === "function");
        this._shutdownTasks.push(task);
    }

    /**
     * @method shutdown
     */
    public async shutdown(): Promise<void> {
        debugLog("ServerEngine#shutdown");

        this._internalState = "shutdown";
        this.setServerState(ServerState.Shutdown);

        // delete any existing sessions
        const tokens = Object.keys(this._sessions).map((key: string) => {
            const session = this._sessions[key];
            return session.authenticationToken;
        });

        // delete and close any orphan subscriptions
        if (this._orphanPublishEngine) {
            this._orphanPublishEngine.shutdown();
        }

        for (const token of tokens) {
            this.closeSession(token, true, "Terminated");
        }

        // all sessions must have been terminated
        assert(this.currentSessionCount === 0);

        // all subscriptions must have been terminated
        assert(this.currentSubscriptionCount === 0, "all subscriptions must have been terminated");

        this._shutdownTasks.push(shutdownAndDisposeAddressSpace);

        // perform registerShutdownTask
        for (const task of this._shutdownTasks) {
            await task.call(this);
        }

        this.dispose();
    }

    /**
     * the number of active sessions
     */
    public get currentSessionCount(): number {
        return this.serverDiagnosticsSummary.currentSessionCount;
    }

    /**
     * the cumulated number of sessions that have been opened since this object exists
     */
    public get cumulatedSessionCount(): number {
        return this.serverDiagnosticsSummary.cumulatedSessionCount;
    }

    /**
     * the number of active subscriptions.
     */
    public get currentSubscriptionCount(): number {
        return this.serverDiagnosticsSummary.currentSubscriptionCount;
    }

    /**
     * the cumulated number of subscriptions that have been created since this object exists
     */
    public get cumulatedSubscriptionCount(): number {
        return this.serverDiagnosticsSummary.cumulatedSubscriptionCount;
    }

    public get rejectedSessionCount(): number {
        return this.serverDiagnosticsSummary.rejectedSessionCount;
    }

    public get rejectedRequestsCount(): number {
        return this.serverDiagnosticsSummary.rejectedRequestsCount;
    }

    public get sessionAbortCount(): number {
        return this.serverDiagnosticsSummary.sessionAbortCount;
    }

    public get sessionTimeoutCount(): number {
        return this.serverDiagnosticsSummary.sessionTimeoutCount;
    }

    public get publishingIntervalCount(): number {
        return this.serverDiagnosticsSummary.publishingIntervalCount;
    }

    public incrementSessionTimeoutCount(): void {
        if (this.serverDiagnosticsSummary && this.serverDiagnosticsEnabled) {
            // The requests include all Services defined in Part 4 of the OPC UA Specification, also requests to create sessions. This number includes the securityRejectedRequestsCount.
            this.serverDiagnosticsSummary.sessionTimeoutCount += 1;
        }
    }
    public incrementSessionAbortCount(): void {
        if (this.serverDiagnosticsSummary && this.serverDiagnosticsEnabled) {
            // The requests include all Services defined in Part 4 of the OPC UA Specification, also requests to create sessions. This number includes the securityRejectedRequestsCount.
            this.serverDiagnosticsSummary.sessionAbortCount += 1;
        }
    }
    public incrementRejectedRequestsCount(): void {
        if (this.serverDiagnosticsSummary && this.serverDiagnosticsEnabled) {
            // The requests include all Services defined in Part 4 of the OPC UA Specification, also requests to create sessions. This number includes the securityRejectedRequestsCount.
            this.serverDiagnosticsSummary.rejectedRequestsCount += 1;
        }
    }

    /**
     * increment rejected session count (also increment rejected requests count)
     */
    public incrementRejectedSessionCount(): void {
        if (this.serverDiagnosticsSummary && this.serverDiagnosticsEnabled) {
            // The requests include all Services defined in Part 4 of the OPC UA Specification, also requests to create sessions. This number includes the securityRejectedRequestsCount.
            this.serverDiagnosticsSummary.rejectedSessionCount += 1;
        }
        this.incrementRejectedRequestsCount();
    }

    public incrementSecurityRejectedRequestsCount(): void {
        if (this.serverDiagnosticsSummary && this.serverDiagnosticsEnabled) {
            // The requests include all Services defined in Part 4 of the OPC UA Specification, also requests to create sessions. This number includes the securityRejectedRequestsCount.
            this.serverDiagnosticsSummary.securityRejectedRequestsCount += 1;
        }
        this.incrementRejectedRequestsCount();
    }

    /**
     * increment rejected session count (also increment rejected requests count)
     */
    public incrementSecurityRejectedSessionCount(): void {
        if (this.serverDiagnosticsSummary && this.serverDiagnosticsEnabled) {
            // The requests include all Services defined in Part 4 of the OPC UA Specification, also requests to create sessions. This number includes the securityRejectedRequestsCount.
            this.serverDiagnosticsSummary.securityRejectedSessionCount += 1;
        }
        this.incrementSecurityRejectedRequestsCount();
    }

    public setShutdownTime(date: Date): void {
        this._expectedShutdownTime = date;
    }
    public setShutdownReason(reason: LocalizedTextLike): void {
        this.addressSpace?.rootFolder.objects.server.serverStatus.shutdownReason.setValueFromSource({
            dataType: DataType.LocalizedText,
            value: coerceLocalizedText(reason)!
        });
    }
    /**
     * @method secondsTillShutdown
     * @return the approximate number of seconds until the server will be shut down. The
     * value is only relevant once the state changes into SHUTDOWN.
     */
    public secondsTillShutdown(): number {
        if (!this._expectedShutdownTime) {
            return 0;
        }
        // ToDo: implement a correct solution here
        const now = Date.now();
        return Math.max(0, Math.ceil((this._expectedShutdownTime.getTime() - now) / 1000));
    }

    /**
     * the name of the server
     */
    public get serverName(): string {
        return this._serverStatus.buildInfo!.productName!;
    }

    /**
     * the server urn
     */
    public get serverNameUrn(): string {
        return this._applicationUri;
    }

    /**
     * the urn of the server namespace
     */
    public get serverNamespaceUrn(): string {
        return this._applicationUri; // "urn:" + engine.serverName;
    }
    public get serverStatus(): ServerStatusDataType {
        return this._serverStatus;
    }

    public setServerState(serverState: ServerState): void {
        assert(serverState !== null && serverState !== undefined);
        this.addressSpace?.rootFolder?.objects?.server?.serverStatus?.state?.setValueFromSource({
            dataType: DataType.Int32,
            value: serverState
        });
    }

    public getServerDiagnosticsEnabledFlag(): boolean {
        const server = this.addressSpace!.rootFolder.objects.server;
        const serverDiagnostics = server.getComponentByName("ServerDiagnostics") as UAVariable;
        if (!serverDiagnostics) {
            return false;
        }
        return serverDiagnostics.readValue().value.value;
    }

    /**
     * @method initialize
     * @async
     *
     * @param options {Object}
     * @param options.nodeset_filename {String} - [option](default : 'mini.Node.Set2.xml' )
     * @param callback
     */
    public initialize(options: OPCUAServerOptions, callback: () => void): void {
        assert(!this.addressSpace); // check that 'initialize' has not been already called

        this._internalState = "initializing";

        options = options || {};
        assert(typeof callback === "function");

        options.nodeset_filename = options.nodeset_filename || nodesets.standard;

        const startTime = new Date();

        debugLog("Loading ", options.nodeset_filename, "...");

        this.addressSpace = AddressSpace.create();

        // register namespace 1 (our namespace);
        const serverNamespace = this.addressSpace.registerNamespace(this.serverNamespaceUrn);
        assert(serverNamespace.index === 1);

        // eslint-disable-next-line max-statements
        generateAddressSpace(this.addressSpace, options.nodeset_filename, () => {
            /* istanbul ignore next */
            if (!this.addressSpace) {
                throw new Error("Internal error");
            }
            const addressSpace = this.addressSpace;

            const endTime = new Date();
            debugLog("Loading ", options.nodeset_filename, " done : ", endTime.getTime() - startTime.getTime(), " ms");

            const bindVariableIfPresent = (nodeId: NodeId, opts: any) => {
                assert(nodeId instanceof NodeId);
                assert(!nodeId.isEmpty());
                const obj = addressSpace.findNode(nodeId);
                if (obj) {
                    __bindVariable(this, nodeId, opts);
                }
                return obj;
            };

            // -------------------------------------------- install default get/put handler
            const server_NamespaceArray_Id = makeNodeId(VariableIds.Server_NamespaceArray); // ns=0;i=2255
            bindVariableIfPresent(server_NamespaceArray_Id, {
                get() {
                    return new Variant({
                        arrayType: VariantArrayType.Array,
                        dataType: DataType.String,
                        value: addressSpace.getNamespaceArray().map((x) => x.namespaceUri)
                    });
                },
                set: null // read only
            });

            const server_NameUrn_var = new Variant({
                arrayType: VariantArrayType.Array,
                dataType: DataType.String,
                value: [
                    this.serverNameUrn // this is us !
                ]
            });
            const server_ServerArray_Id = makeNodeId(VariableIds.Server_ServerArray); // ns=0;i=2254

            bindVariableIfPresent(server_ServerArray_Id, {
                get() {
                    return server_NameUrn_var;
                },
                set: null // read only
            });

            // fix DefaultUserRolePermissions and DefaultUserRolePermissions
            // of namespaces
            const namespaces = makeNodeId(ObjectIds.Server_Namespaces);
            const namespacesNode = addressSpace.findNode(namespaces) as UAObject;
            if (namespacesNode) {
                for (const ns of namespacesNode.getComponents()) {
                    const defaultUserRolePermissions = ns.getChildByName("DefaultUserRolePermissions") as UAVariable | null;
                    if (defaultUserRolePermissions) {
                        defaultUserRolePermissions.setValueFromSource({ dataType: DataType.Null });
                    }
                    const defaultRolePermissions = ns.getChildByName("DefaultRolePermissions") as UAVariable | null;
                    if (defaultRolePermissions) {
                        defaultRolePermissions.setValueFromSource({ dataType: DataType.Null });
                    }
                }
            }

            const bindStandardScalar = (id: number, dataType: DataType, func: () => any, setter_func?: (value: any) => void) => {
                assert(typeof id === "number", "expecting id to be a number");
                assert(typeof func === "function");
                assert(typeof setter_func === "function" || !setter_func);
                assert(dataType !== null); // check invalid dataType

                let setter_func2 = null;
                if (setter_func) {
                    setter_func2 = (variant: Variant) => {
                        const variable2 = !!variant.value;
                        setter_func(variable2);
                        return StatusCodes.Good;
                    };
                }

                const nodeId = makeNodeId(id);

                // make sur the provided function returns a valid value for the variant type
                // This test may not be exhaustive but it will detect obvious mistakes.

                /* istanbul ignore next */
                if (!isValidVariant(VariantArrayType.Scalar, dataType, func())) {
                    errorLog("func", func());
                    throw new Error("bindStandardScalar : func doesn't provide an value of type " + DataType[dataType]);
                }

                return bindVariableIfPresent(nodeId, {
                    get() {
                        return new Variant({
                            arrayType: VariantArrayType.Scalar,
                            dataType,
                            value: func()
                        });
                    },
                    set: setter_func2
                });
            };

            const bindStandardArray = (id: number, variantDataType: DataType, dataType: any, func: () => any[]) => {
                assert(typeof func === "function");
                assert(variantDataType !== null); // check invalid dataType

                const nodeId = makeNodeId(id);

                // make sur the provided function returns a valid value for the variant type
                // This test may not be exhaustive but it will detect obvious mistakes.
                assert(isValidVariant(VariantArrayType.Array, variantDataType, func()));

                bindVariableIfPresent(nodeId, {
                    get() {
                        const value = func();
                        assert(Array.isArray(value));
                        return new Variant({
                            arrayType: VariantArrayType.Array,
                            dataType: variantDataType,
                            value
                        });
                    },
                    set: null // read only
                });
            };

            bindStandardScalar(VariableIds.Server_EstimatedReturnTime, DataType.DateTime, () => minOPCUADate);

            // TimeZoneDataType
            const timeZoneDataType = addressSpace.findDataType(resolveNodeId(DataTypeIds.TimeZoneDataType))!;

            const timeZone = new TimeZoneDataType({
                daylightSavingInOffset: /* boolean*/ false,
                offset: /* int16 */ 0
            });
            bindStandardScalar(VariableIds.Server_LocalTime, DataType.ExtensionObject, () => {
                return timeZone;
            });

            bindStandardScalar(VariableIds.Server_ServiceLevel, DataType.Byte, () => {
                return 255;
            });

            bindStandardScalar(VariableIds.Server_Auditing, DataType.Boolean, () => {
                return this.isAuditing;
            });

            // eslint-disable-next-line @typescript-eslint/no-this-alias
            const engine = this;
            const makeNotReadableIfEnabledFlagIsFalse = (variable: UAVariable) => {
                const originalIsReadable = variable.isReadable;
                variable.isUserReadable = checkReadableFlag;
                function checkReadableFlag(this: UAVariable, context: SessionContext): boolean {
                    const isEnabled = engine.serverDiagnosticsEnabled;
                    return originalIsReadable.call(this, context) && isEnabled;
                }
                for (const c of variable.getAggregates()) {
                    if (c.nodeClass === NodeClass.Variable) {
                        makeNotReadableIfEnabledFlagIsFalse(c as UAVariable);
                    }
                }
            };

            const bindServerDiagnostics = () => {
                bindStandardScalar(
                    VariableIds.Server_ServerDiagnostics_EnabledFlag,
                    DataType.Boolean,
                    () => {
                        return this.serverDiagnosticsEnabled;
                    },
                    (newFlag: boolean) => {
                        this.serverDiagnosticsEnabled = newFlag;
                    }
                );
                const nodeId = makeNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary);
                const serverDiagnosticsSummaryNode = addressSpace.findNode(
                    nodeId
                ) as UAServerDiagnosticsSummary<ServerDiagnosticsSummaryDataType>;

                if (serverDiagnosticsSummaryNode) {
                    serverDiagnosticsSummaryNode.bindExtensionObject(this.serverDiagnosticsSummary);
                    this.serverDiagnosticsSummary = serverDiagnosticsSummaryNode.$extensionObject;
                    makeNotReadableIfEnabledFlagIsFalse(serverDiagnosticsSummaryNode);
                }
            };

            const bindServerStatus = () => {
                const serverStatusNode = addressSpace.findNode(
                    makeNodeId(VariableIds.Server_ServerStatus)
                ) as UAServerStatus<DTServerStatus>;

                if (!serverStatusNode) {
                    return;
                }
                if (serverStatusNode) {
                    serverStatusNode.bindExtensionObject(this._serverStatus);
                    serverStatusNode.minimumSamplingInterval = 1000;
                }

                const currentTimeNode = addressSpace.findNode(
                    makeNodeId(VariableIds.Server_ServerStatus_CurrentTime)
                ) as UAVariable;

                if (currentTimeNode) {
                    currentTimeNode.minimumSamplingInterval = 1000;
                }
                const secondsTillShutdown = addressSpace.findNode(
                    makeNodeId(VariableIds.Server_ServerStatus_SecondsTillShutdown)
                ) as UAVariable;

                if (secondsTillShutdown) {
                    secondsTillShutdown.minimumSamplingInterval = 1000;
                }

                assert(serverStatusNode.$extensionObject);

                serverStatusNode.$extensionObject = new Proxy(serverStatusNode.$extensionObject, {
                    get(target, prop) {
                        if (prop === "currentTime") {
                            serverStatusNode.currentTime.touchValue();
                            return new Date();
                        } else if (prop === "secondsTillShutdown") {
                            serverStatusNode.secondsTillShutdown.touchValue();
                            return engine.secondsTillShutdown();
                        }
                        return (target as any)[prop];
                    }
                });
                this._serverStatus = serverStatusNode.$extensionObject;
            };

            const bindServerCapabilities = () => {
                bindStandardArray(
                    VariableIds.Server_ServerCapabilities_ServerProfileArray,
                    DataType.String,
                    DataType.String,
                    () => {
                        return this.serverCapabilities.serverProfileArray;
                    }
                );

                bindStandardArray(VariableIds.Server_ServerCapabilities_LocaleIdArray, DataType.String, "LocaleId", () => {
                    return this.serverCapabilities.localeIdArray;
                });

                bindStandardScalar(VariableIds.Server_ServerCapabilities_MinSupportedSampleRate, DataType.Double, () => {
                    return this.serverCapabilities.minSupportedSampleRate;
                });

                bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxBrowseContinuationPoints, DataType.UInt16, () => {
                    return this.serverCapabilities.maxBrowseContinuationPoints;
                });

                bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxQueryContinuationPoints, DataType.UInt16, () => {
                    return this.serverCapabilities.maxQueryContinuationPoints;
                });

                bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxHistoryContinuationPoints, DataType.UInt16, () => {
                    return this.serverCapabilities.maxHistoryContinuationPoints;
                });

                // new in 1.05
                bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxSessions, DataType.UInt32, () => {
                    return this.serverCapabilities.maxSessions;
                });
                bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxSubscriptions, DataType.UInt32, () => {
                    return this.serverCapabilities.maxSubscriptions;
                });
                bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxMonitoredItems, DataType.UInt32, () => {
                    return this.serverCapabilities.maxMonitoredItems;
                });
                bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxSubscriptionsPerSession, DataType.UInt32, () => {
                    return this.serverCapabilities.maxSubscriptionsPerSession;
                });
                bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxSelectClauseParameters, DataType.UInt32, () => {
                    return this.serverCapabilities.maxSelectClauseParameters;
                });
                bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxWhereClauseParameters, DataType.UInt32, () => {
                    return this.serverCapabilities.maxWhereClauseParameters;
                });
                //bindStandardArray(VariableIds.Server_ServerCapabilities_ConformanceUnits, DataType.QualifiedName, () => {
                //    return this.serverCapabilities.conformanceUnits;
                //});
                bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxMonitoredItemsPerSubscription, DataType.UInt32, () => {
                    return this.serverCapabilities.maxMonitoredItemsPerSubscription;
                });

                // added by DI : Server-specific period of time in milliseconds until the Server will revoke a lock.
                // TODO bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxInactiveLockTime,
                // TODO     DataType.UInt16, function () {
                // TODO         return self.serverCapabilities.maxInactiveLockTime;
                // TODO });

                bindStandardArray(
                    VariableIds.Server_ServerCapabilities_SoftwareCertificates,
                    DataType.ExtensionObject,
                    "SoftwareCertificates",
                    () => {
                        return this.serverCapabilities.softwareCertificates;
                    }
                );

                bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxArrayLength, DataType.UInt32, () => {
                    return Math.min(this.serverCapabilities.maxArrayLength, Variant.maxArrayLength);
                });

                bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxStringLength, DataType.UInt32, () => {
                    return Math.min(this.serverCapabilities.maxStringLength, BinaryStream.maxStringLength);
                });

                bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxByteStringLength, DataType.UInt32, () => {
                    return Math.min(this.serverCapabilities.maxByteStringLength, BinaryStream.maxByteStringLength);
                });

                const bindOperationLimits = (operationLimits: OperationLimits) => {
                    assert(operationLimits !== null && typeof operationLimits === "object");

                    const keys = Object.keys(operationLimits);

                    keys.forEach((key: string) => {
                        const uid = "Server_ServerCapabilities_OperationLimits_" + upperCaseFirst(key);
                        const nodeId = makeNodeId((VariableIds as any)[uid]);
                        assert(!nodeId.isEmpty());

                        bindStandardScalar((VariableIds as any)[uid], DataType.UInt32, () => {
                            return (operationLimits as any)[key];
                        });
                    });
                };

                bindOperationLimits(this.serverCapabilities.operationLimits);

                // i=2399 [ProgramStateMachineType_ProgramDiagnostics];
                function fix_ProgramStateMachineType_ProgramDiagnostics() {
                    const nodeId = coerceNodeId("i=2399"); // ProgramStateMachineType_ProgramDiagnostics
                    const variable = addressSpace.findNode(nodeId) as UAVariable;
                    if (variable) {
                        (variable as any).$extensionObject = new ProgramDiagnosticDataType({});
                        //  variable.setValueFromSource({
                        //     dataType: DataType.ExtensionObject,
                        //     //     value: new ProgramDiagnostic2DataType()
                        //     value: new ProgramDiagnosticDataType({})
                        // });
                    }
                }
                fix_ProgramStateMachineType_ProgramDiagnostics();
            };

            const bindHistoryServerCapabilities = () => {
                bindStandardScalar(VariableIds.HistoryServerCapabilities_MaxReturnDataValues, DataType.UInt32, () => {
                    return this.historyServerCapabilities.maxReturnDataValues;
                });

                bindStandardScalar(VariableIds.HistoryServerCapabilities_MaxReturnEventValues, DataType.UInt32, () => {
                    return this.historyServerCapabilities.maxReturnEventValues;
                });

                bindStandardScalar(VariableIds.HistoryServerCapabilities_AccessHistoryDataCapability, DataType.Boolean, () => {
                    return this.historyServerCapabilities.accessHistoryDataCapability;
                });
                bindStandardScalar(VariableIds.HistoryServerCapabilities_AccessHistoryEventsCapability, DataType.Boolean, () => {
                    return this.historyServerCapabilities.accessHistoryEventsCapability;
                });
                bindStandardScalar(VariableIds.HistoryServerCapabilities_InsertDataCapability, DataType.Boolean, () => {
                    return this.historyServerCapabilities.insertDataCapability;
                });
                bindStandardScalar(VariableIds.HistoryServerCapabilities_ReplaceDataCapability, DataType.Boolean, () => {
                    return this.historyServerCapabilities.replaceDataCapability;
                });
                bindStandardScalar(VariableIds.HistoryServerCapabilities_UpdateDataCapability, DataType.Boolean, () => {
                    return this.historyServerCapabilities.updateDataCapability;
                });

                bindStandardScalar(VariableIds.HistoryServerCapabilities_InsertEventCapability, DataType.Boolean, () => {
                    return this.historyServerCapabilities.insertEventCapability;
                });

                bindStandardScalar(VariableIds.HistoryServerCapabilities_ReplaceEventCapability, DataType.Boolean, () => {
                    return this.historyServerCapabilities.replaceEventCapability;
                });

                bindStandardScalar(VariableIds.HistoryServerCapabilities_UpdateEventCapability, DataType.Boolean, () => {
                    return this.historyServerCapabilities.updateEventCapability;
                });

                bindStandardScalar(VariableIds.HistoryServerCapabilities_DeleteEventCapability, DataType.Boolean, () => {
                    return this.historyServerCapabilities.deleteEventCapability;
                });

                bindStandardScalar(VariableIds.HistoryServerCapabilities_DeleteRawCapability, DataType.Boolean, () => {
                    return this.historyServerCapabilities.deleteRawCapability;
                });

                bindStandardScalar(VariableIds.HistoryServerCapabilities_DeleteAtTimeCapability, DataType.Boolean, () => {
                    return this.historyServerCapabilities.deleteAtTimeCapability;
                });

                bindStandardScalar(VariableIds.HistoryServerCapabilities_InsertAnnotationCapability, DataType.Boolean, () => {
                    return this.historyServerCapabilities.insertAnnotationCapability;
                });
            };

            bindServerDiagnostics();

            bindServerStatus();

            bindServerCapabilities();

            bindHistoryServerCapabilities();

            const bindExtraStuff = () => {
                // mainly for compliance
                /*
                // The version number for the data type description. i=104
                bindStandardScalar(VariableIds.DataTypeDescriptionType_DataTypeVersion, DataType.String, () => {
                    return "0";
                });

                const namingRuleDataTypeNode = addressSpace.findDataType(resolveNodeId(DataTypeIds.NamingRuleType))! as UADataType;

                if (namingRuleDataTypeNode) {
                    const namingRuleType = (namingRuleDataTypeNode as any)._getEnumerationInfo().nameIndex; // getEnumeration("NamingRuleType");
                    if (!namingRuleType) {
                        throw new Error("Cannot find Enumeration definition for NamingRuleType");
                    }
                    // i=111
                    bindStandardScalar(VariableIds.ModellingRuleType_NamingRule, DataType.Int32, () => {
                        return 0;
                    });

                    // i=112
                    bindStandardScalar(VariableIds.ModellingRule_Mandatory_NamingRule, DataType.Int32, () => {
                        return namingRuleType.Mandatory ? namingRuleType.Mandatory.value : 0;
                    });

                    // i=113
                    bindStandardScalar(VariableIds.ModellingRule_Optional_NamingRule, DataType.Int32, () => {
                        return namingRuleType.Optional ? namingRuleType.Optional.value : 0;
                    });
                    // i=114
                    bindStandardScalar(VariableIds.ModellingRule_ExposesItsArray_NamingRule, DataType.Int32, () => {
                        return namingRuleType.ExposesItsArray ? namingRuleType.ExposesItsArray.value : 0;
                    });
                    bindStandardScalar(VariableIds.ModellingRule_MandatoryPlaceholder_NamingRule, DataType.Int32, () => {
                        return namingRuleType.MandatoryPlaceholder ? namingRuleType.MandatoryPlaceholder.value : 0;
                    });
                }
*/
            };

            bindExtraStuff();

            this.__internal_bindMethod(makeNodeId(MethodIds.Server_GetMonitoredItems), getMonitoredItemsId.bind(this));
            this.__internal_bindMethod(makeNodeId(MethodIds.Server_SetSubscriptionDurable), setSubscriptionDurable.bind(this));

            // fix getMonitoredItems.outputArguments arrayDimensions
            const fixGetMonitoredItemArgs = () => {
                const objects = this.addressSpace!.rootFolder?.objects;
                if (!objects || !objects.server || !objects.server.getMonitoredItems) {
                    return;
                }
                const outputArguments = objects.server.getMonitoredItems.outputArguments!;
                const dataValue = outputArguments.readValue();
                assert(dataValue.value.value[0].arrayDimensions.length === 1 && dataValue.value.value[0].arrayDimensions[0] === 0);
                assert(dataValue.value.value[1].arrayDimensions.length === 1 && dataValue.value.value[1].arrayDimensions[0] === 0);
            };
            fixGetMonitoredItemArgs();

            const prepareServerDiagnostics = () => {
                const addressSpace1 = this.addressSpace!;

                if (!addressSpace1.rootFolder.objects) {
                    return;
                }
                const server = addressSpace1.rootFolder.objects.server;

                if (!server) {
                    return;
                }

                // create SessionsDiagnosticsSummary
                const serverDiagnosticsNode = server.getComponentByName("ServerDiagnostics") as UAServerDiagnostics;
                if (!serverDiagnosticsNode) {
                    return;
                }
                if (true) {
                    // set serverDiagnosticsNode enabledFlag writeable for admin user only
                    // TO DO ...
                    serverDiagnosticsNode.enabledFlag.userAccessLevel = makeAccessLevelFlag("CurrentRead");
                    serverDiagnosticsNode.enabledFlag.accessLevel = makeAccessLevelFlag("CurrentRead");
                }

                // A Server may not expose the SamplingIntervalDiagnosticsArray if it does not use fixed sampling rates.
                // because we are not using fixed sampling rate, we need to remove the optional SamplingIntervalDiagnosticsArray
                // component
                const samplingIntervalDiagnosticsArray = serverDiagnosticsNode.getComponentByName(
                    "SamplingIntervalDiagnosticsArray"
                );
                if (samplingIntervalDiagnosticsArray) {
                    addressSpace.deleteNode(samplingIntervalDiagnosticsArray);
                    const s = serverDiagnosticsNode.getComponents();
                }

                const subscriptionDiagnosticsArrayNode = serverDiagnosticsNode.getComponentByName(
                    "SubscriptionDiagnosticsArray"
                )! as UADynamicVariableArray<SessionDiagnosticsDataType>;
                assert(subscriptionDiagnosticsArrayNode.nodeClass === NodeClass.Variable);
                bindExtObjArrayNode(subscriptionDiagnosticsArrayNode, "SubscriptionDiagnosticsType", "subscriptionId");

                makeNotReadableIfEnabledFlagIsFalse(subscriptionDiagnosticsArrayNode);

                const sessionsDiagnosticsSummary = serverDiagnosticsNode.getComponentByName("SessionsDiagnosticsSummary")!;

                const sessionDiagnosticsArray = sessionsDiagnosticsSummary.getComponentByName(
                    "SessionDiagnosticsArray"
                )! as UADynamicVariableArray<SessionDiagnosticsDataType>;
                assert(sessionDiagnosticsArray.nodeClass === NodeClass.Variable);

                bindExtObjArrayNode(sessionDiagnosticsArray, "SessionDiagnosticsVariableType", "sessionId");

                const varType = addressSpace.findVariableType("SessionSecurityDiagnosticsType");
                if (!varType) {
                    debugLog("Warning cannot find SessionSecurityDiagnosticsType variable Type");
                } else {
                    const sessionSecurityDiagnosticsArray = sessionsDiagnosticsSummary.getComponentByName(
                        "SessionSecurityDiagnosticsArray"
                    )! as UADynamicVariableArray<SessionSecurityDiagnosticsDataType>;
                    assert(sessionSecurityDiagnosticsArray.nodeClass === NodeClass.Variable);
                    bindExtObjArrayNode(sessionSecurityDiagnosticsArray, "SessionSecurityDiagnosticsType", "sessionId");
                    ensureObjectIsSecure(sessionSecurityDiagnosticsArray);
                }
            };

            prepareServerDiagnostics();

            this._internalState = "initialized";
            this.setServerState(ServerState.Running);
            setImmediate(() => callback());
        });
    }

    /**
     *
     * @method browseSingleNode
     * @param nodeId {NodeId|String} : the nodeid of the element to browse
     * @param browseDescription
     * @param browseDescription.browseDirection {BrowseDirection} :
     * @param browseDescription.referenceTypeId {String|NodeId}
     * @param [context]
     * @return  the browse result
     */
    public browseSingleNode(nodeId: NodeIdLike, browseDescription: BrowseDescription, context?: ISessionContext): BrowseResult {
        const addressSpace = this.addressSpace!;
        return addressSpace.browseSingleNode(nodeId, browseDescription, context);
    }

    public async browseWithAutomaticExpansion(
        nodesToBrowse: BrowseDescription[],
        context?: ISessionContext
    ): Promise<BrowseResult[]> {
        // do expansion first
        for (const browseDescription of nodesToBrowse) {
            const nodeId = resolveNodeId(browseDescription.nodeId);
            const node = this.addressSpace!.findNode(nodeId);
            if (node) {
                if (node.onFirstBrowseAction) {
                    try {
                        await node.onFirstBrowseAction();
                        node.onFirstBrowseAction = undefined;
                    } catch (err) {
                        if (err instanceof Error) {
                            errorLog("onFirstBrowseAction method has failed", err.message);
                        }
                        errorLog(err);
                    }
                    assert(node.onFirstBrowseAction === undefined, "expansion can only be made once");
                }
            }
        }
        return this.browse(nodesToBrowse, context);
    }
    /**
     *
     */
    public browse(nodesToBrowse: BrowseDescription[], context?: ISessionContext): BrowseResult[] {
        const results: BrowseResult[] = [];
        for (const browseDescription of nodesToBrowse) {
            const nodeId = resolveNodeId(browseDescription.nodeId);
            const r = this.browseSingleNode(nodeId, browseDescription, context);
            results.push(r);
        }
        return results;
    }

    /**
     *
     * @method readSingleNode
     * @param context
     * @param nodeId
     * @param attributeId
     * @param [timestampsToReturn=TimestampsToReturn.Neither]
     * @return DataValue
     */
    public readSingleNode(
        context: ISessionContext,
        nodeId: NodeId | string,
        attributeId: AttributeIds,
        timestampsToReturn?: TimestampsToReturn
    ): DataValue {
        context.currentTime = getCurrentClock();
        return this._readSingleNode(
            context,
            new ReadValueId({
                attributeId,
                nodeId: resolveNodeId(nodeId)
            }),
            timestampsToReturn
        );
    }

    /**
     *
     *
     *    Maximum age of the value to be read in milliseconds. The age of the value is based on the difference between
     *    the ServerTimestamp and the time when the  Server starts processing the request. For example if the Client
     *    specifies a maxAge of 500 milliseconds and it takes 100 milliseconds until the Server starts  processing
     *    the request, the age of the returned value could be 600 milliseconds  prior to the time it was requested.
     *    If the Server has one or more values of an Attribute that are within the maximum age, it can return any one
     *    of the values or it can read a new value from the data  source. The number of values of an Attribute that
     *    a Server has depends on the  number of MonitoredItems that are defined for the Attribute. In any case,
     *    the Client can make no assumption about which copy of the data will be returned.
     *    If the Server does not have a value that is within the maximum age, it shall attempt to read a new value
     *    from the data source.
     *    If the Server cannot meet the requested maxAge, it returns its 'best effort' value rather than rejecting the
     *    request.
     *    This may occur when the time it takes the Server to process and return the new data value after it has been
     *    accessed is greater than the specified maximum age.
     *    If maxAge is set to 0, the Server shall attempt to read a new value from the data source.
     *    If maxAge is set to the max Int32 value or greater, the Server shall attempt to get a cached value.
     *    Negative values are invalid for maxAge.
     *
     *  @return  an array of DataValue
     */
    public read(context: ISessionContext, readRequest: ReadRequest): DataValue[] {
        assert(context instanceof SessionContext);
        assert(readRequest instanceof ReadRequest);
        assert(readRequest.maxAge >= 0);

        const timestampsToReturn = readRequest.timestampsToReturn;

        const nodesToRead = readRequest.nodesToRead || [];
        assert(Array.isArray(nodesToRead));

        context.currentTime = getCurrentClock();

        const dataValues: DataValue[] = [];
        for (const readValueId of nodesToRead) {
            const dataValue = this._readSingleNode(context, readValueId, timestampsToReturn);
            if (timestampsToReturn === TimestampsToReturn.Server) {
                dataValue.sourceTimestamp = null;
                dataValue.sourcePicoseconds = 0;
            }
            if (
                (timestampsToReturn === TimestampsToReturn.Both || timestampsToReturn === TimestampsToReturn.Server) &&
                (!dataValue.serverTimestamp || dataValue.serverTimestamp.getTime() === minOPCUADate.getTime())
            ) {
                dataValue.serverTimestamp = context.currentTime.timestamp;
                dataValue.sourcePicoseconds = 0; // context.currentTime.picosecond // do we really need picosecond here ? this would inflate binary data
            }
            dataValues.push(dataValue);
        }
        return dataValues;
    }

    /**
     *
     * @method writeSingleNode
     * @param context
     * @param writeValue
     * @param callback
     * @param callback.err
     * @param callback.statusCode
     * @async
     */
    public writeSingleNode(
        context: ISessionContext,
        writeValue: WriteValue,
        callback: (err: Error | null, statusCode?: StatusCode) => void
    ): void {
        assert(context instanceof SessionContext);
        assert(typeof callback === "function");
        assert(writeValue.schema.name === "WriteValue");
        assert(writeValue.value instanceof DataValue);

        if (writeValue.value.value === null) {
            return callback(null, StatusCodes.BadTypeMismatch);
        }

        assert(writeValue.value.value instanceof Variant);

        const nodeId = writeValue.nodeId;

        const obj = this.__findNode(nodeId) as UAVariable;
        if (!obj) {
            return callback(null, StatusCodes.BadNodeIdUnknown);
        } else {
            obj.writeAttribute(context, writeValue, callback);
        }
    }

    /**
     * write a collection of nodes
     * @method write
     * @param context
     * @param nodesToWrite
     * @param callback
     * @param callback.err
     * @param callback.results
     * @async
     */
    public write(
        context: ISessionContext,
        nodesToWrite: WriteValue[],
        callback: (err: Error | null, statusCodes?: StatusCode[]) => void
    ): void {
        assert(context instanceof SessionContext);
        assert(typeof callback === "function");

        context.currentTime = getCurrentClock();

        ensureDatatypeExtractedWithCallback(
            this.addressSpace!,
            (err2: Error | null, extraDataTypeManager?: ExtraDataTypeManager) => {
                if (err2) {
                    return callback(err2);
                }
                const performWrite = (writeValue: WriteValue, inner_callback: StatusCodeCallback) => {
                    resolveOpaqueOnAddressSpace(this.addressSpace!, writeValue.value.value!)
                        .then(() => {
                            this.writeSingleNode(context, writeValue, inner_callback);
                        })
                        .catch(inner_callback);
                };
                // tslint:disable:array-type
                async.map(nodesToWrite, performWrite, (err?: Error | null, statusCodes?: (StatusCode | undefined)[]) => {
                    assert(Array.isArray(statusCodes));
                    callback(err!, statusCodes as StatusCode[]);
                });
            }
        );
    }

    /**
     *
     */
    public historyReadSingleNode(
        context: ISessionContext,
        nodeId: NodeId,
        attributeId: AttributeIds,
        historyReadDetails: ReadRawModifiedDetails | ReadEventDetails | ReadProcessedDetails | ReadAtTimeDetails,
        timestampsToReturn: TimestampsToReturn,
        continuationData: ContinuationData,
        callback: (err: Error | null, results?: HistoryReadResult) => void
    ): void {
        if (timestampsToReturn === TimestampsToReturn.Invalid) {
            callback(
                null,
                new HistoryReadResult({
                    statusCode: StatusCodes.BadTimestampsToReturnInvalid
                })
            );
            return;
        }
        assert(context instanceof SessionContext);
        this._historyReadSingleNode(
            context,
            new HistoryReadValueId({
                nodeId
            }),
            historyReadDetails,
            timestampsToReturn,
            continuationData,
            callback
        );
    }

    /**
     *
     *  @method historyRead
     *  @param context {SessionContext}
     *  @param historyReadRequest {HistoryReadRequest}
     *  @param historyReadRequest.requestHeader  {RequestHeader}
     *  @param historyReadRequest.historyReadDetails  {HistoryReadDetails}
     *  @param historyReadRequest.timestampsToReturn  {TimestampsToReturn}
     *  @param historyReadRequest.releaseContinuationPoints  {Boolean}
     *  @param historyReadRequest.nodesToRead {HistoryReadValueId[]}
     *  @param callback
     *  @param callback.err
     *  @param callback.results {HistoryReadResult[]}
     */
    public historyRead(
        context: ISessionContext,
        historyReadRequest: HistoryReadRequest,
        callback: (err: Error | null, results: HistoryReadResult[]) => void
    ): void {
        assert(context instanceof SessionContext);
        assert(historyReadRequest instanceof HistoryReadRequest);
        assert(typeof callback === "function");

        const timestampsToReturn = historyReadRequest.timestampsToReturn;
        const historyReadDetails = historyReadRequest.historyReadDetails! as HistoryReadDetails;
        const releaseContinuationPoints = historyReadRequest.releaseContinuationPoints;
        assert(historyReadDetails instanceof HistoryReadDetails);
        //  ReadAnnotationDataDetails | ReadAtTimeDetails | ReadEventDetails | ReadProcessedDetails | ReadRawModifiedDetails;

        const nodesToRead = historyReadRequest.nodesToRead || ([] as HistoryReadValueId[]);
        assert(Array.isArray(nodesToRead));

        // special cases with ReadProcessedDetails
        interface M {
            nodeToRead: HistoryReadValueId;
            processDetail: ReadProcessedDetails;
            index: number;
        }

        const _q = async (m: M): Promise<HistoryReadResult> => {
            return new Promise((resolve) => {
                const continuationPoint = m.nodeToRead.continuationPoint;
                this._historyReadSingleNode(
                    context,
                    m.nodeToRead,
                    m.processDetail,
                    timestampsToReturn,
                    { continuationPoint, releaseContinuationPoints /**, index = ??? */ },
                    (err: Error | null, result?: any) => {
                        if (err && !result) {
                            errorLog("Internal error", err.message);
                            result = new HistoryReadResult({ statusCode: StatusCodes.BadInternalError });
                        }
                        resolve(result);
                    }
                );
            });
        };

        if (historyReadDetails instanceof ReadProcessedDetails) {
            //
            if (!historyReadDetails.aggregateType || historyReadDetails.aggregateType.length !== nodesToRead.length) {
                return callback(null, [new HistoryReadResult({ statusCode: StatusCodes.BadInvalidArgument })]);
            }
            const promises: Promise<HistoryReadResult>[] = [];
            let index = 0;
            for (const nodeToRead of nodesToRead) {
                const aggregateType = historyReadDetails.aggregateType[index];
                const processDetail = new ReadProcessedDetails({ ...historyReadDetails, aggregateType: [aggregateType] });
                promises.push(_q({ nodeToRead, processDetail, index }));
                index++;
            }
            Promise.all(promises).then((results: HistoryReadResult[]) => {
                callback(null, results);
            });
            return;
        }

        const _r = async (nodeToRead: HistoryReadValueId, index: number) => {
            const continuationPoint = nodeToRead.continuationPoint;
            return new Promise<HistoryReadResult>((resolve, reject) => {
                this._historyReadSingleNode(
                    context,
                    nodeToRead,
                    historyReadDetails,
                    timestampsToReturn,
                    { continuationPoint, releaseContinuationPoints, index },
                    (err: Error | null, result?: any) => {
                        if (err && !result) {
                            result = new HistoryReadResult({ statusCode: StatusCodes.BadInternalError });
                        }
                        resolve(result);
                        // it's not guaranteed that the historical read process is really asynchronous
                    }
                );
            });
        };
        const promises: Promise<HistoryReadResult>[] = [];
        let index = 0;
        for (const nodeToRead of nodesToRead) {
            promises.push(_r(nodeToRead, index));
            index++;
        }
        Promise.all(promises).then((results: HistoryReadResult[]) => {
            callback(null, results);
        });
    }

    public getOldestInactiveSession(): ServerSession | null {
        // search screwed or closed session first
        let tmp = Object.values(this._sessions).filter(
            (session1: ServerSession) =>
                session1.status === "screwed" || session1.status === "disposed" || session1.status === "closed"
        );
        if (tmp.length === 0) {
            // if none available, tap into the session that are not yet activated
            tmp = Object.values(this._sessions).filter((session1: ServerSession) => session1.status === "new");
        }
        if (tmp.length === 0) return null;
        let session = tmp[0];
        for (let i = 1; i < tmp.length; i++) {
            const c = tmp[i];
            if (session.creationDate.getTime() < c.creationDate.getTime()) {
                session = c;
            }
        }
        return session;
    }

    /**
     * create a new server session object.
     * @class ServerEngine
     * @method createSession
     * @param  [options] {Object}
     * @param  [options.sessionTimeout = 1000] {Number} sessionTimeout
     * @param  [options.clientDescription] {ApplicationDescription}
     * @return {ServerSession}
     */
    public createSession(options: CreateSessionOption): ServerSession {
        options = options || {};

        debugLog("createSession : increasing serverDiagnosticsSummary cumulatedSessionCount/currentSessionCount ");
        this.serverDiagnosticsSummary.cumulatedSessionCount += 1;
        this.serverDiagnosticsSummary.currentSessionCount += 1;

        this.clientDescription = options.clientDescription || new ApplicationDescription({});

        const sessionTimeout = options.sessionTimeout || 1000;
        assert(typeof sessionTimeout === "number");

        const session = new ServerSession(this, sessionTimeout);

        debugLog("createSession :sessionTimeout = ", session.sessionTimeout);

        const key = session.authenticationToken.toString();

        this._sessions[key] = session;

        // see spec OPC Unified Architecture,  Part 2 page 26 Release 1.02
        // TODO : When a Session is created, the Server adds an entry for the Client
        //        in its SessionDiagnosticsArray Variable

        session.on("new_subscription", (subscription: Subscription) => {
            this.serverDiagnosticsSummary.cumulatedSubscriptionCount += 1;
            // add the subscription diagnostics in our subscriptions diagnostics array
            // note currentSubscriptionCount is handled directly with a special getter
        });

        session.on("subscription_terminated", (subscription: Subscription) => {
            // remove the subscription diagnostics in our subscriptions diagnostics array
            // note currentSubscriptionCount is handled directly with a special getter
        });

        // OPC Unified Architecture, Part 4 23 Release 1.03
        // Sessions are terminated by the Server automatically if the Client fails to issue a Service request on the
        // Session within the timeout period negotiated by the Server in the CreateSession Service response.
        // This protects the Server against Client failures and against situations where a failed underlying
        // connection cannot be re-established. Clients shall be prepared to submit requests in a timely manner
        // prevent the Session from closing automatically. Clients may explicitly terminate sessions using the
        // CloseSession Service.
        session.on("timeout", () => {
            // the session hasn't been active for a while , probably because the client has disconnected abruptly
            // it is now time to close the session completely
            this.serverDiagnosticsSummary.sessionTimeoutCount += 1;
            session.sessionName = session.sessionName || "";

            const channel = session.channel;
            errorLog(
                chalk.cyan("Server: closing SESSION "),
                session.status,
                chalk.yellow(session.sessionName),
                chalk.yellow(session.nodeId.toString()),
                chalk.cyan(" because of timeout = "),
                session.sessionTimeout,
                chalk.cyan(" has expired without a keep alive"),
                chalk.bgCyan("channel = "),
                channel?.remoteAddress,
                " port = ",
                channel?.remotePort
            );

            // If a Server terminates a Session for any other reason, Subscriptions  associated with the Session,
            // are not deleted. => deleteSubscription= false
            this.closeSession(session.authenticationToken, /*deleteSubscription=*/ false, /* reason =*/ "Timeout");

            this.incrementSessionTimeoutCount();
        });

        return session;
    }

    /**
     * @method closeSession
     * @param authenticationToken
     * @param deleteSubscriptions {Boolean} : true if session's subscription shall be deleted
     * @param {String} [reason = "CloseSession"] the reason for closing the session (
     *                 shall be "Timeout", "Terminated" or "CloseSession")
     *
     *
     * what the specs say:
     * -------------------
     *
     * If a Client invokes the CloseSession Service then all Subscriptions associated with the Session are also deleted
     * if the deleteSubscriptions flag is set to TRUE. If a Server terminates a Session for any other reason,
     * Subscriptions associated with the Session, are not deleted. Each Subscription has its own lifetime to protect
     * against data loss in the case of a Session termination. In these cases, the Subscription can be reassigned to
     * another Client before its lifetime expires.
     */
    public closeSession(authenticationToken: NodeId, deleteSubscriptions: boolean, reason: ClosingReason): void {
        reason = reason || "CloseSession";
        assert(typeof reason === "string");
        assert(reason === "Timeout" || reason === "Terminated" || reason === "CloseSession" || reason === "Forcing");

        debugLog("ServerEngine.closeSession ", authenticationToken.toString(), deleteSubscriptions);

        const session = this.getSession(authenticationToken);

        // istanbul ignore next
        if (!session) {
            throw new Error("cannot find session with this authenticationToken " + authenticationToken.toString());
        }

        if (!deleteSubscriptions) {
            // Live Subscriptions will not be deleted, but transferred to the orphanPublishEngine
            // until they time out or until a other session transfer them back to it.
            if (!this._orphanPublishEngine) {
                this._orphanPublishEngine = new ServerSidePublishEngineForOrphanSubscription({ maxPublishRequestInQueue: 0 });
            }

            debugLog("transferring remaining live subscription to orphanPublishEngine !");
            ServerSidePublishEngine.transferSubscriptionsToOrphan(session.publishEngine, this._orphanPublishEngine);
        }

        session.close(deleteSubscriptions, reason);

        assert(session.status === "closed");

        debugLog(" engine.serverDiagnosticsSummary.currentSessionCount -= 1;");
        this.serverDiagnosticsSummary.currentSessionCount -= 1;

        // xx //TODO make sure _closedSessions gets cleaned at some point
        // xx self._closedSessions[key] = session;

        // remove sessionDiagnostics from server.ServerDiagnostics.SessionsDiagnosticsSummary.SessionDiagnosticsSummary
        delete this._sessions[authenticationToken.toString()];
        session.dispose();
    }

    public findSubscription(subscriptionId: number): Subscription | null {
        const subscriptions: Subscription[] = [];
        Object.values(this._sessions).map((session) => {
            if (subscriptions.length) {
                return;
            }
            const subscription = session.publishEngine.getSubscriptionById(subscriptionId);
            if (subscription) {
                subscriptions.push(subscription);
            }
        });
        if (subscriptions.length) {
            assert(subscriptions.length === 1);
            return subscriptions[0];
        }
        return this.findOrphanSubscription(subscriptionId);
    }

    public findOrphanSubscription(subscriptionId: number): Subscription | null {
        if (!this._orphanPublishEngine) {
            return null;
        }
        return this._orphanPublishEngine.getSubscriptionById(subscriptionId);
    }

    public deleteOrphanSubscription(subscription: Subscription): StatusCode {
        if (!this._orphanPublishEngine) {
            return StatusCodes.BadInternalError;
        }
        assert(this.findSubscription(subscription.id));

        const c = this._orphanPublishEngine.subscriptionCount;
        subscription.terminate();
        subscription.dispose();
        assert(this._orphanPublishEngine.subscriptionCount === c - 1);
        return StatusCodes.Good;
    }

    /**
     * @method transferSubscription
     * @param session           {ServerSession}  - the new session that will own the subscription
     * @param subscriptionId    {IntegerId}      - the subscription Id to transfer
     * @param sendInitialValues {Boolean}        - true if initial values will be resent.
     * @return                  {TransferResult}
     */
    public async transferSubscription(
        session: ServerSession,
        subscriptionId: number,
        sendInitialValues: boolean
    ): Promise<TransferResult> {
        if (subscriptionId <= 0) {
            return new TransferResult({ statusCode: StatusCodes.BadSubscriptionIdInvalid });
        }

        const subscription = this.findSubscription(subscriptionId);
        if (!subscription) {
            return new TransferResult({ statusCode: StatusCodes.BadSubscriptionIdInvalid });
        }

        // check that session have same userIdentity
        if (!sessionsCompatibleForTransfer(subscription.$session, session)) {
            return new TransferResult({ statusCode: StatusCodes.BadUserAccessDenied });
        }

        // update diagnostics
        subscription.subscriptionDiagnostics.transferRequestCount++;

        // now check that new session has sufficient right
        // if (session.authenticationToken.toString() !== subscription.authenticationToken.toString()) {
        //     console.log("ServerEngine#transferSubscription => BadUserAccessDenied");
        //     return new TransferResult({ statusCode: StatusCodes.BadUserAccessDenied });
        // }
        if ((session.publishEngine as any) === subscription.publishEngine) {
            // subscription is already in this session !!
            return new TransferResult({ statusCode: StatusCodes.BadNothingToDo });
        }
        if (session === subscription.$session) {
            // subscription is already in this session !!
            return new TransferResult({ statusCode: StatusCodes.BadNothingToDo });
        }

        // The number of times the subscription has been transferred to an alternate client.
        subscription.subscriptionDiagnostics.transferredToAltClientCount++;
        // The number of times the subscription has been transferred to an alternate session for the same client.
        subscription.subscriptionDiagnostics.transferredToSameClientCount++;

        const nbSubscriptionBefore = session.publishEngine.subscriptionCount;

        if (subscription.$session) {
            subscription.$session._unexposeSubscriptionDiagnostics(subscription);
        }
        
        await ServerSidePublishEngine.transferSubscription(subscription, session.publishEngine, sendInitialValues);
        subscription.$session = session;

        session._exposeSubscriptionDiagnostics(subscription);

        assert((subscription.publishEngine as any) === session.publishEngine);
        // assert(session.publishEngine.subscriptionCount === nbSubscriptionBefore + 1);

        const result = new TransferResult({
            availableSequenceNumbers: subscription.getAvailableSequenceNumbers(),
            statusCode: StatusCodes.Good
        });

        // istanbul ignore next
        if (doDebug) {
            debugLog("TransferResult", result.toString());
        }

        return result;
    }

    /**
     * retrieve a session by its authenticationToken.
     *
     * @method getSession
     * @param authenticationToken
     * @param activeOnly
     * @return {ServerSession}
     */
    public getSession(authenticationToken: NodeId, activeOnly?: boolean): ServerSession | null {
        if (
            !authenticationToken ||
            (authenticationToken.identifierType && authenticationToken.identifierType !== NodeIdType.BYTESTRING)
        ) {
            return null; // wrong type !
        }
        const key = authenticationToken.toString();
        let session = this._sessions[key];
        if (!activeOnly && !session) {
            session = this._closedSessions[key];
        }
        return session;
    }

    /**
     */
    public browsePath(browsePath: BrowsePath): BrowsePathResult {
        return this.addressSpace!.browsePath(browsePath);
    }

    /**
     *
     * performs a call to ```asyncRefresh``` on all variable nodes that provide an async refresh func.
     *
     * @method refreshValues
     * @param nodesToRefresh {Array<Object>}  an array containing the node to consider
     * Each element of the array shall be of the form { nodeId: <xxx>, attributeIds: <value> }.
     * @param callback
     * @param callback.err
     * @param callback.data  an array containing value read
     * The array length matches the number of  nodeIds that are candidate for an async refresh (i.e: nodes that
     * are of type Variable with asyncRefresh func }
     *
     * @async
     */
    public refreshValues(
        nodesToRefresh: ReadValueId[] | HistoryReadValueId[],
        maxAge: number,
        callback: (err: Error | null, dataValues?: DataValue[]) => void
    ): void {
        const referenceTime = new Date(Date.now() - maxAge);

        assert(typeof callback === "function");
        const objectMap: Record<string, BaseNode> = {};
        for (const nodeToRefresh of nodesToRefresh) {
            // only consider node  for which the caller wants to read the Value attribute
            // assuming that Value is requested if attributeId is missing,
            if (nodeToRefresh instanceof ReadValueId && nodeToRefresh.attributeId !== AttributeIds.Value) {
                continue;
            }
            // ... and that are valid object and instances of Variables ...
            const obj = this.addressSpace!.findNode(nodeToRefresh.nodeId);
            if (!obj || !(obj.nodeClass === NodeClass.Variable)) {
                continue;
            }
            // ... and that have been declared as asynchronously updating
            if (typeof (obj as any).refreshFunc !== "function") {
                continue;
            }
            const key = obj.nodeId.toString();
            if (objectMap[key]) {
                continue;
            }

            objectMap[key] = obj;
        }

        const objectArray = Object.values(objectMap);
        if (objectArray.length === 0) {
            // nothing to do
            return callback(null, []);
        }
        // perform all asyncRefresh in parallel
        async.map(
            objectArray,
            (obj: BaseNode, inner_callback: CallbackT<DataValue>) => {
                if (obj.nodeClass !== NodeClass.Variable) {
                    inner_callback(
                        null,
                        new DataValue({
                            statusCode: StatusCodes.BadNodeClassInvalid
                        })
                    );
                    return;
                }
                try {
                    (obj as UAVariable).asyncRefresh(referenceTime, (err, dataValue) => {
                        inner_callback(err, dataValue);
                    });
                } catch (err) {
                    // istanbul ignore next
                    if (!(err instanceof Error)) {
                        throw new Error("internal error");
                    }
                    errorLog("asyncRefresh internal error", err);
                    inner_callback(err);
                }
            },
            (err?: Error | null, arrResult?: (DataValue | undefined)[]) => {
                callback(err || null, arrResult as DataValue[]);
            }
        );
    }

    private _exposeSubscriptionDiagnostics(subscription: Subscription): void {
        debugLog("ServerEngine#_exposeSubscriptionDiagnostics", subscription.subscriptionId);
        const subscriptionDiagnosticsArray = this._getServerSubscriptionDiagnosticsArrayNode();
        const subscriptionDiagnostics = subscription.subscriptionDiagnostics;
        assert((subscriptionDiagnostics as any).$subscription === subscription);
        assert(subscriptionDiagnostics instanceof SubscriptionDiagnosticsDataType);

        if (subscriptionDiagnostics && subscriptionDiagnosticsArray) {
            addElement(subscriptionDiagnostics, subscriptionDiagnosticsArray);
        }
    }

    protected _unexposeSubscriptionDiagnostics(subscription: Subscription): void {
        const serverSubscriptionDiagnosticsArray = this._getServerSubscriptionDiagnosticsArrayNode();
        const subscriptionDiagnostics = subscription.subscriptionDiagnostics;
        assert(subscriptionDiagnostics instanceof SubscriptionDiagnosticsDataType);
        if (subscriptionDiagnostics && serverSubscriptionDiagnosticsArray) {
            const node = (serverSubscriptionDiagnosticsArray as any)[subscription.id];
            removeElement(serverSubscriptionDiagnosticsArray, subscriptionDiagnostics);
            /*assert(
                !(subscriptionDiagnosticsArray as any)[subscription.id],
                " subscription node must have been removed from subscriptionDiagnosticsArray"
            );
            */
        }
        debugLog("ServerEngine#_unexposeSubscriptionDiagnostics", subscription.subscriptionId);
    }

    /**
     * create a new subscription
     * @return {Subscription}
     */
    public _createSubscriptionOnSession(session: ServerSession, request: CreateSubscriptionRequestLike): Subscription {
        assert(Object.prototype.hasOwnProperty.call(request, "requestedPublishingInterval")); // Duration
        assert(Object.prototype.hasOwnProperty.call(request, "requestedLifetimeCount")); // Counter
        assert(Object.prototype.hasOwnProperty.call(request, "requestedMaxKeepAliveCount")); // Counter
        assert(Object.prototype.hasOwnProperty.call(request, "maxNotificationsPerPublish")); // Counter
        assert(Object.prototype.hasOwnProperty.call(request, "publishingEnabled")); // Boolean
        assert(Object.prototype.hasOwnProperty.call(request, "priority")); // Byte

        // adjust publishing parameters
        const publishingInterval = request.requestedPublishingInterval || 0;
        const maxKeepAliveCount = request.requestedMaxKeepAliveCount || 0;
        const lifeTimeCount = request.requestedLifetimeCount || 0;

        const subscription = new Subscription({
            id: _get_next_subscriptionId(),
            lifeTimeCount,
            maxKeepAliveCount,
            maxNotificationsPerPublish: request.maxNotificationsPerPublish,
            priority: request.priority || 0,
            publishEngine: session.publishEngine as any, //
            publishingEnabled: request.publishingEnabled,
            publishingInterval,
            // -------------------
            sessionId: NodeId.nullNodeId,
            globalCounter: this._globalCounter,
            serverCapabilities: this.serverCapabilities // shared
        });

        // add subscriptionDiagnostics
        this._exposeSubscriptionDiagnostics(subscription);

        assert((subscription.publishEngine as any) === session.publishEngine);
        session.publishEngine.add_subscription(subscription);

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const engine = this;
        subscription.once("terminated", function (this: Subscription) {
            engine._unexposeSubscriptionDiagnostics(this);
        });

        return subscription;
    }

    private __findNode(nodeId: NodeId): BaseNode | null {
        if (nodeId.namespace >= (this.addressSpace?.getNamespaceArray().length || 0)) {
            return null;
        }
        const namespace = this.addressSpace!.getNamespace(nodeId.namespace)!;
        return namespace.findNode2(nodeId)!;
    }

    private _readSingleNode(context: ISessionContext, nodeToRead: ReadValueId, timestampsToReturn?: TimestampsToReturn): DataValue {
        assert(context instanceof SessionContext);
        const nodeId: NodeId = nodeToRead.nodeId!;
        const attributeId: AttributeIds = nodeToRead.attributeId!;
        const indexRange: NumericRange = nodeToRead.indexRange!;
        const dataEncoding: QualifiedName = nodeToRead.dataEncoding;

        if (timestampsToReturn === TimestampsToReturn.Invalid) {
            return new DataValue({ statusCode: StatusCodes.BadTimestampsToReturnInvalid });
        }

        timestampsToReturn = coerceTimestampsToReturn(timestampsToReturn);

        const obj = this.__findNode(nodeId!);

        let dataValue;
        if (!obj) {
            // may be return BadNodeIdUnknown in dataValue instead ?
            // Object Not Found
            return new DataValue({ statusCode: StatusCodes.BadNodeIdUnknown });
        } else {
            // check access
            //    BadUserAccessDenied
            //    BadNotReadable
            //    invalid attributes : BadNodeAttributesInvalid
            //    invalid range      : BadIndexRangeInvalid
            dataValue = obj.readAttribute(context, attributeId, indexRange, dataEncoding);
            dataValue = apply_timestamps_no_copy(dataValue, timestampsToReturn, attributeId);

            return dataValue;
        }
    }

    private _historyReadSingleNode(
        context: ISessionContext,
        nodeToRead: HistoryReadValueId,
        historyReadDetails: HistoryReadDetails,
        timestampsToReturn: TimestampsToReturn,
        continuationData: ContinuationData,
        callback: CallbackT<HistoryReadResult>
    ): void {
        assert(context instanceof SessionContext);
        assert(typeof callback === "function");

        const nodeId = nodeToRead.nodeId;
        const indexRange = nodeToRead.indexRange;
        const dataEncoding = nodeToRead.dataEncoding;
        const continuationPoint = nodeToRead.continuationPoint;

        timestampsToReturn = coerceTimestampsToReturn(timestampsToReturn);
        if (timestampsToReturn === TimestampsToReturn.Invalid) {
            return callback(null, new HistoryReadResult({ statusCode: StatusCodes.BadTimestampsToReturnInvalid }));
        }

        const obj = this.__findNode(nodeId) as UAVariable;

        if (!obj) {
            // may be return BadNodeIdUnknown in dataValue instead ?
            // Object Not Found
            callback(null, new HistoryReadResult({ statusCode: StatusCodes.BadNodeIdUnknown }));
            return;
        } else {
            // istanbul ignore next
            if (!obj.historyRead) {
                // note : Object and View may also support historyRead to provide Event historical data
                //        todo implement historyRead for Object and View
                const msg =
                    " this node doesn't provide historyRead! probably not a UAVariable\n " +
                    obj.nodeId.toString() +
                    " " +
                    obj.browseName.toString() +
                    "\n" +
                    "with " +
                    nodeToRead.toString() +
                    "\n" +
                    "HistoryReadDetails " +
                    historyReadDetails.toString();
                if (doDebug) {
                    debugLog(chalk.cyan("ServerEngine#_historyReadSingleNode "), chalk.white.bold(msg));
                }
                const err = new Error(msg);
                // object has no historyRead method
                setImmediate(callback.bind(null, err));
                return;
            }
            // check access
            //    BadUserAccessDenied
            //    BadNotReadable
            //    invalid attributes : BadNodeAttributesInvalid
            //    invalid range      : BadIndexRangeInvalid
            obj.historyRead(
                context,
                historyReadDetails,
                indexRange,
                dataEncoding,
                continuationData,
                (err: Error | null, result?: HistoryReadResult) => {
                    if (err || !result) {
                        return callback(err);
                    }
                    assert(result!.statusCode instanceof StatusCode);
                    assert(result!.isValid());
                    // result = apply_timestamps(result, timestampsToReturn, attributeId);
                    callback(err, result);
                }
            );
        }
    }

    /**
     */
    private __internal_bindMethod(nodeId: NodeId, func: MethodFunctor) {
        assert(typeof func === "function");
        assert(nodeId instanceof NodeId);

        const methodNode = this.addressSpace!.findNode(nodeId)! as UAMethod;
        if (!methodNode) {
            return;
        }
        // istanbul ignore else
        if (methodNode && methodNode.bindMethod) {
            methodNode.bindMethod(func);
        } else {
            warningLog(
                chalk.yellow("WARNING:  cannot bind a method with id ") +
                    chalk.cyan(nodeId.toString()) +
                    chalk.yellow(". please check your nodeset.xml file or add this node programmatically")
            );
            warningLog(traceFromThisProjectOnly());
        }
    }

    private _getServerSubscriptionDiagnosticsArrayNode(): UADynamicVariableArray<SubscriptionDiagnosticsDataType> | null {
        // istanbul ignore next
        if (!this.addressSpace) {
            doDebug && debugLog("ServerEngine#_getServerSubscriptionDiagnosticsArray : no addressSpace");

            return null; // no addressSpace
        }
        const subscriptionDiagnosticsType = this.addressSpace.findVariableType("SubscriptionDiagnosticsType");
        if (!subscriptionDiagnosticsType) {
            doDebug &&
                debugLog("ServerEngine#_getServerSubscriptionDiagnosticsArray " + ": cannot find SubscriptionDiagnosticsType");
        }

        // SubscriptionDiagnosticsArray = i=2290
        const subscriptionDiagnosticsArrayNode = this.addressSpace.findNode(
            makeNodeId(VariableIds.Server_ServerDiagnostics_SubscriptionDiagnosticsArray)
        )!;

        return subscriptionDiagnosticsArrayNode as UADynamicVariableArray<SubscriptionDiagnosticsDataType>;
    }
}
