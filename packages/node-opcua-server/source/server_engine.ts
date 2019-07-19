/**
 * @module node-opcua-server
 */
// tslint:disable:no-console
import * as async from "async";
import chalk from "chalk";
import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import * as _ from "underscore";

import {
    addElement,
    AddressSpace,
    BaseNode,
    bindExtObjArrayNode,
    Callback,
    DataValueCallback,
    ensureDatatypeExtractedWithCallback,
    generateAddressSpace,
    MethodFunctor,
    removeElement,
    SessionContext,
    UADynamicVariableArray,
    UAMethod,
    UAServerDiagnosticsSummary,
    UAServerStatus,
    UAVariable
} from "node-opcua-address-space";
import { apply_timestamps, DataValue } from "node-opcua-data-value";

import {
    ServerDiagnosticsSummaryDataType,
    ServerState,
    ServerStatusDataType,
    SubscriptionDiagnosticsDataType
} from "node-opcua-common";
import { AttributeIds, BrowseDirection, NodeClass } from "node-opcua-data-model";
import { makeNodeId, NodeId, NodeIdLike, NodeIdType, resolveNodeId } from "node-opcua-nodeid";
import { BrowseResult } from "node-opcua-service-browse";
import { ReadRequest, TimestampsToReturn } from "node-opcua-service-read";

import { TransferResult } from "node-opcua-service-subscription";

import { CreateSubscriptionRequestLike } from "node-opcua-client";
import { ExtraDataTypeManager, resolveDynamicExtensionObject } from "node-opcua-client-dynamic-extension-object";
import { DataTypeIds, MethodIds, VariableIds } from "node-opcua-constants";
import { minOPCUADate } from "node-opcua-date-time";
import { checkDebugFlag, make_debugLog, make_errorLog, trace_from_this_projet_only } from "node-opcua-debug";
import { nodesets } from "node-opcua-nodesets";
import { ObjectRegistry } from "node-opcua-object-registry";
import { CallMethodResult } from "node-opcua-service-call";
import { ApplicationDescription } from "node-opcua-service-endpoints";
import {
    HistoryReadDetails,
    HistoryReadRequest,
    HistoryReadResult,
    HistoryReadValueId
} from "node-opcua-service-history";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
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
    ReadValueIdOptions,
    SessionDiagnosticsDataType,
    TimeZoneDataType,
    WriteValue
} from "node-opcua-types";
import { DataType, isValidVariant, Variant, VariantArrayType } from "node-opcua-variant";

import { HistoryServerCapabilities, HistoryServerCapabilitiesOptions } from "./history_server_capabilities";
import { MonitoredItem } from "./monitored_item";
import { OperationLimits, ServerCapabilities, ServerCapabilitiesOptions } from "./server_capabilities";
import { ServerSidePublishEngine } from "./server_publish_engine";
import { ServerSidePublishEngineForOrphanSubscription } from "./server_publish_engine_for_orphan_subscriptions";
import { ServerSession } from "./server_session";
import { Subscription } from "./server_subscription";

const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const doDebug = checkDebugFlag(__filename);

function shutdownAndDisposeAddressSpace(this: ServerEngine) {
    if (this.addressSpace) {
        this.addressSpace.shutdown();
        this.addressSpace.dispose();
        delete this.addressSpace;
    }
}

// binding methods
function getMonitoredItemsId(
  this: ServerEngine,
  inputArguments: any,
  context: SessionContext,
  callback: any
) {

    const engine = this; // ServerEngine

    assert(_.isArray(inputArguments));
    assert(_.isFunction(callback));

    assert(context.hasOwnProperty("session"), " expecting a session id in the context object");

    const session = context.session as ServerSession;
    if (!session) {
        return callback(null, { statusCode: StatusCodes.BadInternalError });
    }

    const subscriptionId = inputArguments[0].value;
    const subscription = session.getSubscription(subscriptionId);
    if (!subscription) {
        // subscription may belongs to a different session  that ours
        if (engine.findSubscription(subscriptionId)) {
            // if yes, then access to  Subscription data should be denied
            return callback(null, { statusCode: StatusCodes.BadUserAccessDenied });
        }

        return callback(null, { statusCode: StatusCodes.BadSubscriptionIdInvalid });
    }
    const result = subscription.getMonitoredItems();
    assert(result.statusCode);
    assert(_.isArray(result.serverHandles));
    assert(_.isArray(result.clientHandles));
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

function __bindVariable(
  self: ServerEngine,
  nodeId: NodeIdLike,
  options?: any
) {
    options = options || {};
    // must have a get and a set property
    assert(_.difference(["get", "set"], _.keys(options)).length === 0);

    const variable = self.addressSpace!.findNode(nodeId) as UAVariable;
    if (variable && variable.bindVariable) {
        variable.bindVariable(options);
        assert(_.isFunction(variable.asyncRefresh));
        assert(_.isFunction((variable as any).refreshFunc));
    } else {
        console.log("Warning: cannot bind object with id ", nodeId.toString(),
          " please check your nodeset.xml file or add this node programmatically");
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
    public serverStatus: ServerStatusDataType;

    public _rejectedSessionCount: number = 0;

    private _sessions: { [key: string]: ServerSession };
    private _closedSessions: { [key: string]: ServerSession };
    private _orphanPublishEngine?: ServerSidePublishEngineForOrphanSubscription;
    private status: string;
    private _shutdownTask: any[];
    private _applicationUri: string;

    constructor(options: ServerEngineOptions) {
        super();

        options = options || { applicationUri: "" } as ServerEngineOptions;
        options.buildInfo = options.buildInfo || {};

        ServerEngine.registry.register(this);

        this._sessions = {};
        this._closedSessions = {};
        this._orphanPublishEngine = undefined; // will be constructed on demand

        this.isAuditing = _.isBoolean(options.isAuditing) ? options.isAuditing : false;

        options.buildInfo.buildDate = options.buildInfo.buildDate || new Date();
        // ---------------------------------------------------- ServerStatusDataType
        this.serverStatus = new ServerStatusDataType({
            buildInfo: options.buildInfo,
            currentTime: new Date(),
            secondsTillShutdown: 0,
            shutdownReason: { text: "" },
            startTime: new Date(),
            state: ServerState.NoConfiguration
        });

        // --------------------------------------------------- ServerCapabilities
        options.serverCapabilities = options.serverCapabilities || {};
        options.serverCapabilities.serverProfileArray = options.serverCapabilities.serverProfileArray || [
            "Standard UA Server Profile",
            "Embedded UA Server Profile",
            "Micro Embedded Device Server Profile",
            "Nano Embedded Device Server Profile"
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
        assert(this.serverDiagnosticsSummary.hasOwnProperty("currentSessionCount"));

        // note spelling is different for serverDiagnosticsSummary.currentSubscriptionCount
        //      and sessionDiagnostics.currentSubscriptionsCount ( with an s)
        assert(this.serverDiagnosticsSummary.hasOwnProperty("currentSubscriptionCount"));

        (this.serverDiagnosticsSummary as any).__defineGetter__("currentSubscriptionCount", () => {
            // currentSubscriptionCount returns the total number of subscriptions
            // that are currently active on all sessions
            let counter = 0;
            _.values(this._sessions).forEach((session: ServerSession) => {
                counter += session.currentSubscriptionCount;
            });
            return counter;
        });

        this.status = "creating";

        this.setServerState(ServerState.NoConfiguration);

        this.addressSpace = null;

        this._shutdownTask = [];

        this._applicationUri = "";
        if (typeof options.applicationUri === "function") {
            (this as any).__defineGetter__("_applicationUri", options.applicationUri);
        } else {
            this._applicationUri = options.applicationUri || "<unset _applicationUri>";
        }

        options.serverDiagnosticsEnabled = options.hasOwnProperty("serverDiagnosticsEnable")
          ? options.serverDiagnosticsEnabled : true;

        this.serverDiagnosticsEnabled = options.serverDiagnosticsEnabled!;

    }

    public dispose() {

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

        this._shutdownTask = [];
        this.serverStatus = null as any as ServerStatusDataType;
        this.status = "disposed";

        this.removeAllListeners();

        ServerEngine.registry.unregister(this);
    }

    public get startTime(): Date {
        return this.serverStatus.startTime!;
    }

    public get currentTime(): Date {
        return this.serverStatus.currentTime!;
    }

    public get buildInfo(): BuildInfo {
        return this.serverStatus.buildInfo;
    }

    /**
     * register a function that will be called when the server will perform its shut down.
     * @method registerShutdownTask
     */
    public registerShutdownTask(task: any) {
        const engine = this;
        assert(_.isFunction(task));
        engine._shutdownTask.push(task);
    }

    /**
     * @method shutdown
     */
    public shutdown() {

        debugLog("ServerEngine#shutdown");

        this.status = "shutdown";
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

        // xx console.log("xxxxxxxxx ServerEngine.shutdown must terminate "+ tokens.length," sessions");

        tokens.forEach((token: any) => {
            this.closeSession(token, true, "Terminated");
        });

        // all sessions must have been terminated
        assert(this.currentSessionCount === 0);

        // all subscriptions must have been terminated
        assert(this.currentSubscriptionCount === 0, "all subscriptions must have been terminated");

        this._shutdownTask.push(shutdownAndDisposeAddressSpace);

        // perform registerShutdownTask
        this._shutdownTask.forEach((task: any) => {
            task.call(this);
        });

        this.dispose();
    }

    /**
     * the number of active sessions
     */
    public get currentSessionCount() {
        return this.serverDiagnosticsSummary.currentSessionCount;
    }

    /**
     * the cumulated number of sessions that have been opened since this object exists
     */
    public get cumulatedSessionCount() {
        return this.serverDiagnosticsSummary.cumulatedSessionCount;
    }

    /**
     * the number of active subscriptions.
     */
    public get currentSubscriptionCount() {
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

    /**
     * @method secondsTillShutdown
     * @return the approximate number of seconds until the server will be shut down. The
     * value is only relevant once the state changes into SHUTDOWN.
     */
    public secondsTillShutdown(): number {
        // ToDo: implement a correct solution here
        return 0;
    }

    /**
     * the name of the server
     */
    public get serverName(): string {
        return this.serverStatus.buildInfo!.productName!;
    }

    /**
     * the server urn
     */
    public get serverNameUrn() {
        return this._applicationUri;
    }

    /**
     * the urn of the server namespace
     */
    public get serverNamespaceUrn() {
        return this._applicationUri; // "urn:" + engine.serverName;
    }

    public setServerState(serverState: ServerState) {
        assert(serverState !== null && serverState !== undefined);
        this.serverStatus.state = serverState;
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
    public initialize(
      options: any,
      callback: any
    ) {

        const engine = this;
        assert(!engine.addressSpace); // check that 'initialize' has not been already called

        engine.status = "initializing";

        options = options || {};
        assert(_.isFunction(callback));

        options.nodeset_filename = options.nodeset_filename || nodesets.standard_nodeset_file;

        const startTime = new Date();

        debugLog("Loading ", options.nodeset_filename, "...");

        engine.addressSpace = AddressSpace.create();

        // register namespace 1 (our namespace);
        const serverNamespace = engine.addressSpace.registerNamespace(engine.serverNamespaceUrn);
        assert(serverNamespace.index === 1);

        generateAddressSpace(engine.addressSpace, options.nodeset_filename, () => {

            if (!engine.addressSpace) {
                throw new Error("Internal error");
            }
            const addressSpace = engine.addressSpace;

            const endTime = new Date();
            debugLog("Loading ", options.nodeset_filename, " done : ",
              endTime.getTime() - startTime.getTime(), " ms");

            engine.setServerState(ServerState.Running);

            function bindVariableIfPresent(nodeId: NodeId, opts: any) {
                assert(nodeId instanceof NodeId);
                assert(!nodeId.isEmpty());
                const obj = addressSpace.findNode(nodeId);
                if (obj) {
                    __bindVariable(engine, nodeId, opts);
                }
                return obj;
            }

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
                    engine.serverNameUrn // this is us !
                ]
            });
            const server_ServerArray_Id = makeNodeId(VariableIds.Server_ServerArray); // ns=0;i=2254

            bindVariableIfPresent(server_ServerArray_Id, {
                get() {
                    return server_NameUrn_var;
                },
                set: null // read only
            });

            function bindStandardScalar(
              id: number,
              dataType: DataType,
              func: () => any,
              setter_func?: (value: any) => void
            ) {

                assert(_.isNumber(id), "expecting id to be a number");
                assert(_.isFunction(func));
                assert(_.isFunction(setter_func) || !setter_func);
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
            }

            function bindStandardArray(
              id: number,
              variantDataType: DataType,
              dataType: any,
              func: () => any[]
            ) {

                assert(_.isFunction(func));
                assert(variantDataType !== null); // check invalid dataType

                const nodeId = makeNodeId(id);

                // make sur the provided function returns a valid value for the variant type
                // This test may not be exhaustive but it will detect obvious mistakes.
                assert(isValidVariant(VariantArrayType.Array, variantDataType, func()));

                bindVariableIfPresent(nodeId, {
                    get() {
                        const value = func();
                        assert(_.isArray(value));
                        return new Variant({
                            arrayType: VariantArrayType.Array,
                            dataType: variantDataType,
                            value
                        });
                    },
                    set: null // read only
                });
            }

            bindStandardScalar(VariableIds.Server_EstimatedReturnTime,
              DataType.DateTime, () => minOPCUADate);

            // TimeZoneDataType
            const timeZoneDataType = addressSpace.findDataType(resolveNodeId(DataTypeIds.TimeZoneDataType))!;
            // xx console.log(timeZoneDataType.toString());

            const timeZone = new TimeZoneDataType({
                daylightSavingInOffset: /* boolean*/ false,
                offset: /* int16 */ 0
            });
            bindStandardScalar(VariableIds.Server_LocalTime,
              DataType.ExtensionObject, () => {
                  return timeZone;
              });

            bindStandardScalar(VariableIds.Server_ServiceLevel,
              DataType.Byte, () => {
                  return 255;
              });

            bindStandardScalar(VariableIds.Server_Auditing,
              DataType.Boolean, () => {
                  return engine.isAuditing;
              });

            function bindServerDiagnostics() {

                bindStandardScalar(VariableIds.Server_ServerDiagnostics_EnabledFlag,
                  DataType.Boolean, () => {
                      return engine.serverDiagnosticsEnabled;
                  }, (newFlag: boolean) => {
                      engine.serverDiagnosticsEnabled = newFlag;
                  });

                const nodeId = makeNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary);
                const serverDiagnosticsSummary = addressSpace.findNode(nodeId) as UAServerDiagnosticsSummary;

                if (serverDiagnosticsSummary) {
                    serverDiagnosticsSummary.bindExtensionObject(engine.serverDiagnosticsSummary);
                    engine.serverDiagnosticsSummary = serverDiagnosticsSummary.$extensionObject;
                }

            }

            function bindServerStatus() {

                const serverStatusNode =
                  addressSpace.findNode(makeNodeId(VariableIds.Server_ServerStatus)) as UAServerStatus;

                if (!serverStatusNode) {
                    return;
                }
                if (serverStatusNode) {
                    serverStatusNode.bindExtensionObject(engine.serverStatus);
                    // xx serverStatusNode.updateExtensionObjectPartial(self.serverStatus);
                    // xx self.serverStatus = serverStatusNode.$extensionObject;
                    serverStatusNode.minimumSamplingInterval = 1000;
                }

                const currentTimeNode =
                  addressSpace.findNode(makeNodeId(VariableIds.Server_ServerStatus_CurrentTime)) as UAVariable;

                if (currentTimeNode) {
                    currentTimeNode.minimumSamplingInterval = 1000;
                }
                const secondsTillShutdown =
                  addressSpace.findNode(makeNodeId(VariableIds.Server_ServerStatus_SecondsTillShutdown)) as UAVariable;

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

            }

            function bindServerCapabilities() {

                bindStandardArray(VariableIds.Server_ServerCapabilities_ServerProfileArray,
                  DataType.String, DataType.String, () => {
                      return engine.serverCapabilities.serverProfileArray;
                  });

                bindStandardArray(VariableIds.Server_ServerCapabilities_LocaleIdArray,
                  DataType.String, "LocaleId", () => {
                      return engine.serverCapabilities.localeIdArray;
                  });

                bindStandardScalar(VariableIds.Server_ServerCapabilities_MinSupportedSampleRate,
                  DataType.Double, () => {
                      return engine.serverCapabilities.minSupportedSampleRate;
                  });

                bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxBrowseContinuationPoints,
                  DataType.UInt16, () => {
                      return engine.serverCapabilities.maxBrowseContinuationPoints;
                  });

                bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxQueryContinuationPoints,
                  DataType.UInt16, () => {
                      return engine.serverCapabilities.maxQueryContinuationPoints;
                  });

                bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxHistoryContinuationPoints,
                  DataType.UInt16, () => {
                      return engine.serverCapabilities.maxHistoryContinuationPoints;
                  });

                // added by DI : Server-specific period of time in milliseconds until the Server will revoke a lock.
                // TODO bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxInactiveLockTime,
                // TODO     DataType.UInt16, function () {
                // TODO         return self.serverCapabilities.maxInactiveLockTime;
                // TODO });

                bindStandardArray(VariableIds.Server_ServerCapabilities_SoftwareCertificates,
                  DataType.ExtensionObject, "SoftwareCertificates", () => {
                      return engine.serverCapabilities.softwareCertificates;
                  });

                bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxArrayLength,
                  DataType.UInt32, () => {
                      return engine.serverCapabilities.maxArrayLength;
                  });

                bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxStringLength,
                  DataType.UInt32, () => {
                      return engine.serverCapabilities.maxStringLength;
                  });

                bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxByteStringLength,
                  DataType.UInt32, () => {
                      return engine.serverCapabilities.maxByteStringLength;
                  });

                function bindOperationLimits(operationLimits: OperationLimits) {

                    assert(_.isObject(operationLimits));

                    function upperCaseFirst(str: string) {
                        return str.slice(0, 1).toUpperCase() + str.slice(1);
                    }

                    // Xx bindStandardArray(VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerWrite,
                    // Xx     DataType.UInt32, "UInt32", function () {  return operationLimits.maxNodesPerWrite;  });
                    const keys = Object.keys(operationLimits);

                    keys.forEach((key: string) => {

                        const uid = "Server_ServerCapabilities_OperationLimits_" + upperCaseFirst(key);
                        const nodeId = makeNodeId((VariableIds as any)[uid]);
                        // xx console.log("xxx Binding ",uid,nodeId.toString());
                        assert(!nodeId.isEmpty());

                        bindStandardScalar((VariableIds as any)[uid],
                          DataType.UInt32, () => {
                              return (operationLimits as any)[key];
                          });
                    });
                }

                bindOperationLimits(engine.serverCapabilities.operationLimits);

            }

            function bindHistoryServerCapabilities() {

                bindStandardScalar(VariableIds.HistoryServerCapabilities_MaxReturnDataValues,
                  DataType.UInt32, () => {
                      return engine.historyServerCapabilities.maxReturnDataValues;
                  });

                bindStandardScalar(VariableIds.HistoryServerCapabilities_MaxReturnEventValues,
                  DataType.UInt32, () => {
                      return engine.historyServerCapabilities.maxReturnEventValues;
                  });

                bindStandardScalar(VariableIds.HistoryServerCapabilities_AccessHistoryDataCapability,
                  DataType.Boolean, () => {
                      return engine.historyServerCapabilities.accessHistoryDataCapability;
                  });
                bindStandardScalar(VariableIds.HistoryServerCapabilities_AccessHistoryEventsCapability,
                  DataType.Boolean, () => {
                      return engine.historyServerCapabilities.accessHistoryEventsCapability;
                  });
                bindStandardScalar(VariableIds.HistoryServerCapabilities_InsertDataCapability,
                  DataType.Boolean, () => {
                      return engine.historyServerCapabilities.insertDataCapability;
                  });
                bindStandardScalar(VariableIds.HistoryServerCapabilities_ReplaceDataCapability,
                  DataType.Boolean, () => {
                      return engine.historyServerCapabilities.replaceDataCapability;
                  });
                bindStandardScalar(VariableIds.HistoryServerCapabilities_UpdateDataCapability,
                  DataType.Boolean, () => {
                      return engine.historyServerCapabilities.updateDataCapability;
                  });

                bindStandardScalar(VariableIds.HistoryServerCapabilities_InsertEventCapability,
                  DataType.Boolean, () => {
                      return engine.historyServerCapabilities.insertEventCapability;
                  });

                bindStandardScalar(VariableIds.HistoryServerCapabilities_ReplaceEventCapability,
                  DataType.Boolean, () => {
                      return engine.historyServerCapabilities.replaceEventCapability;
                  });

                bindStandardScalar(VariableIds.HistoryServerCapabilities_UpdateEventCapability,
                  DataType.Boolean, () => {
                      return engine.historyServerCapabilities.updateEventCapability;
                  });

                bindStandardScalar(VariableIds.HistoryServerCapabilities_DeleteEventCapability,
                  DataType.Boolean, () => {
                      return engine.historyServerCapabilities.deleteEventCapability;
                  });

                bindStandardScalar(VariableIds.HistoryServerCapabilities_DeleteRawCapability,
                  DataType.Boolean, () => {
                      return engine.historyServerCapabilities.deleteRawCapability;
                  });

                bindStandardScalar(VariableIds.HistoryServerCapabilities_DeleteAtTimeCapability,
                  DataType.Boolean, () => {
                      return engine.historyServerCapabilities.deleteAtTimeCapability;
                  });

                bindStandardScalar(VariableIds.HistoryServerCapabilities_InsertAnnotationCapability,
                  DataType.Boolean, () => {
                      return engine.historyServerCapabilities.insertAnnotationCapability;
                  });

            }

            bindServerDiagnostics();

            bindServerStatus();

            bindServerCapabilities();

            bindHistoryServerCapabilities();

            function bindExtraStuff() {
                // mainly for compliance

                // The version number for the data type description. i=104
                bindStandardScalar(VariableIds.DataTypeDescriptionType_DataTypeVersion,
                  DataType.UInt16, () => {
                      return 0.0;
                  });

                const nrt = addressSpace.findDataType(resolveNodeId(DataTypeIds.NamingRuleType))!;
                // xx console.log(nrt.toString());
                if (nrt) {
                    const namingRuleType = (nrt as any)._getDefinition().nameIndex; // getEnumeration("NamingRuleType");
                    // i=111
                    bindStandardScalar(VariableIds.ModellingRuleType_NamingRule,
                      DataType.UInt16, () => {
                          return 0;
                      });

                    // i=112
                    bindStandardScalar(VariableIds.ModellingRule_Mandatory_NamingRule,
                      DataType.UInt16, () => {
                          return namingRuleType.Mandatory ? namingRuleType.Mandatory.value : 0;
                      });

                    // i=113
                    bindStandardScalar(VariableIds.ModellingRule_Optional_NamingRule,
                      DataType.UInt16, () => {
                          return namingRuleType.Optional ? namingRuleType.Optional.value : 0;
                      });
                    // i=114
                    bindStandardScalar(VariableIds.ModellingRule_ExposesItsArray_NamingRule,
                      DataType.UInt16, () => {
                          return namingRuleType.ExposesItsArray ? namingRuleType.ExposesItsArray.value : 0;
                      });
                    bindStandardScalar(VariableIds.ModellingRule_MandatoryShared_NamingRule,
                      DataType.UInt16, () => {
                          return namingRuleType.MandatoryShared ? namingRuleType.MandatoryShared.value : 0;
                      });

                }
            }

            bindExtraStuff();

            engine.__internal_bindMethod(
              makeNodeId(MethodIds.Server_GetMonitoredItems),
              getMonitoredItemsId.bind(engine));

            // fix getMonitoredItems.outputArguments arrayDimensions
            (function fixGetMonitoredItemArgs() {
                const objects = engine.addressSpace.rootFolder.objects;
                if (!objects || !objects.server || !objects.server.getMonitoredItems) {
                    return;
                }
                const outputArguments = objects.server.getMonitoredItems.outputArguments!;
                const dataValue = outputArguments.readValue();
                assert(dataValue.value.value[0].arrayDimensions.length === 1
                  && dataValue.value.value[0].arrayDimensions[0] === 0);
                assert(dataValue.value.value[1].arrayDimensions.length === 1
                  && dataValue.value.value[1].arrayDimensions[0] === 0);
            })();

            function prepareServerDiagnostics() {

                const addressSpace1 = engine.addressSpace!;

                if (!addressSpace1.rootFolder.objects) {
                    return;
                }
                const server = addressSpace1.rootFolder.objects.server;

                if (!server) {
                    return;
                }

                // create SessionsDiagnosticsSummary
                const serverDiagnostics = server.getComponentByName("ServerDiagnostics");
                if (!serverDiagnostics) {
                    return;
                }

                const subscriptionDiagnosticsArray =
                  serverDiagnostics.getComponentByName("SubscriptionDiagnosticsArray")! as
                    UADynamicVariableArray<SessionDiagnosticsDataType>;
                assert(subscriptionDiagnosticsArray.nodeClass === NodeClass.Variable);
                bindExtObjArrayNode(subscriptionDiagnosticsArray,
                  "SubscriptionDiagnosticsType", "subscriptionId");

                const sessionDiagnosticsArray =
                  serverDiagnostics.getComponentByName("SessionsDiagnosticsSummary")!
                    .getComponentByName("SessionDiagnosticsArray")! as
                    UADynamicVariableArray<SessionDiagnosticsDataType>;

                assert(sessionDiagnosticsArray.nodeClass === NodeClass.Variable);
                bindExtObjArrayNode(sessionDiagnosticsArray,
                  "SessionDiagnosticsVariableType", "sessionId");
            }

            prepareServerDiagnostics();

            engine.status = "initialized";
            setImmediate(callback);
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
    public browseSingleNode(
      nodeId: NodeIdLike,
      browseDescription: BrowseDescription,
      context?: SessionContext
    ): BrowseResult {
        const engine = this;
        const addressSpace = engine.addressSpace!;
        return addressSpace.browseSingleNode(nodeId, browseDescription, context);
    }

    /**
     *
     */
    public browse(
      nodesToBrowse: BrowseDescription[],
      context?: SessionContext
    ): BrowseResult[] {
        const engine = this;
        assert(_.isArray(nodesToBrowse));

        const results: BrowseResult[] = [];
        for (const browseDescription of nodesToBrowse) {

            const nodeId = resolveNodeId(browseDescription.nodeId);

            const r = engine.browseSingleNode(nodeId, browseDescription, context);
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
      context: SessionContext,
      nodeId: NodeId,
      attributeId: AttributeIds,
      timestampsToReturn?: TimestampsToReturn
    ): DataValue {
        const engine = this;

        return engine._readSingleNode(context,
          {
              attributeId,
              nodeId
          },
          timestampsToReturn);
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
     *    If maxAge is set to the max Int32 value or greater, the Server shall attempt to geta cached value.
     *    Negative values are invalid for maxAge.
     *
     *  @return  an array of DataValue
     */
    public read(context: SessionContext, readRequest: ReadRequest): DataValue[] {

        assert(context instanceof SessionContext);
        assert(readRequest instanceof ReadRequest);
        assert(readRequest.maxAge >= 0);

        const engine = this;
        const timestampsToReturn = readRequest.timestampsToReturn;

        const nodesToRead = readRequest.nodesToRead || [];
        assert(_.isArray(nodesToRead));

        context.currentTime = new Date();

        const dataValues: DataValue[] = [];
        for (let i = 0; i < nodesToRead.length; i++) {
            const readValueId = nodesToRead[i];
            dataValues[i] = engine._readSingleNode(context, readValueId, timestampsToReturn);
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
      context: SessionContext,
      writeValue: WriteValue,
      callback: (err: Error | null, statusCode?: StatusCode) => void
    ) {

        const engine = this;
        assert(context instanceof SessionContext);
        assert(_.isFunction(callback));
        assert(writeValue.schema.name === "WriteValue");
        assert(writeValue.value instanceof DataValue);

        if (writeValue.value.value === null) {
            return callback(null, StatusCodes.BadTypeMismatch);
        }

        assert(writeValue.value.value instanceof Variant);

        const nodeId = writeValue.nodeId;

        const obj = engine.__findObject(nodeId);
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
      context: SessionContext,
      nodesToWrite: WriteValue[],
      callback: (err: Error | null, statusCodes?: StatusCode[]) => void
    ) {

        assert(context instanceof SessionContext);
        assert(_.isFunction(callback));

        const engine = this;

        context.currentTime = new Date();

        let l_extraDataTypeManager: ExtraDataTypeManager;

        function performWrite(
          writeValue: WriteValue,
          inner_callback: (err: Error | null, statusCode?: StatusCode) => void
        ) {
            assert(writeValue instanceof WriteValue);
            resolveDynamicExtensionObject(writeValue.value.value, l_extraDataTypeManager);
            engine.writeSingleNode(context, writeValue, inner_callback);
        }

        ensureDatatypeExtractedWithCallback(this.addressSpace, (err2: Error|null, extraDataTypeManager: ExtraDataTypeManager) => {

            l_extraDataTypeManager = extraDataTypeManager;

            // tslint:disable:array-type
            async.map(nodesToWrite, performWrite,
                (err?: Error | null, statusCodes?: (StatusCode | undefined)[]) => {
                    assert(_.isArray(statusCodes));
                    callback(err!, statusCodes as StatusCode[]);
                });

        });

    }

    /**
     *
     */
    public historyReadSingleNode(
      context: SessionContext,
      nodeId: NodeId,
      attributeId: AttributeIds,
      historyReadDetails:
        ReadRawModifiedDetails | ReadEventDetails | ReadProcessedDetails | ReadAtTimeDetails,
      timestampsToReturn: TimestampsToReturn,
      callback: (err: Error | null, results?: HistoryReadResult) => void
    ): void {

        if (timestampsToReturn === TimestampsToReturn.Invalid) {
            callback(null,
              new HistoryReadResult({
                  statusCode: StatusCodes.BadTimestampsToReturnInvalid
              }));
            return;
        }
        assert(context instanceof SessionContext);
        this._historyReadSingleNode(context,
          new HistoryReadValueId({
              nodeId
          }), historyReadDetails, timestampsToReturn, callback);
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
      context: SessionContext,
      historyReadRequest: HistoryReadRequest,
      callback: (err: Error | null, results: HistoryReadResult[]) => void
    ) {

        assert(context instanceof SessionContext);
        assert(historyReadRequest instanceof HistoryReadRequest);
        assert(_.isFunction(callback));

        const engine = this;
        const timestampsToReturn = historyReadRequest.timestampsToReturn;
        const historyReadDetails = historyReadRequest.historyReadDetails! as HistoryReadDetails;

        const nodesToRead = historyReadRequest.nodesToRead || ([] as HistoryReadValueId[]);

        assert(historyReadDetails instanceof HistoryReadDetails);
        assert(_.isArray(nodesToRead));

        const historyData: HistoryReadResult[] = [];
        async.eachSeries(
          nodesToRead,
          (historyReadValueId: HistoryReadValueId, cbNode: () => void) => {
              engine._historyReadSingleNode(
                context,
                historyReadValueId,
                historyReadDetails,
                timestampsToReturn,
                (err: Error | null, result?: any) => {

                    if (err && !result) {
                        result = new HistoryReadResult({ statusCode: StatusCodes.BadInternalError });
                    }
                    historyData.push(result);
                    async.setImmediate(cbNode);
                    // it's not guaranteed that the historical read process is really asynchronous
                });
          }, (err?: Error | null) => {
              assert(historyData.length === nodesToRead.length);
              callback(err || null, historyData);
          });
    }

    public getOldestUnactivatedSession(): ServerSession | null {

        const tmp = _.filter(this._sessions, (session1: ServerSession) => {
            return session1.status === "new";
        });
        if (tmp.length === 0) {
            return null;
        }
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
    public createSession(options: any): ServerSession {

        options = options || {};

        debugLog("createSession : increasing serverDiagnosticsSummary cumulatedSessionCount/currentSessionCount ");
        this.serverDiagnosticsSummary.cumulatedSessionCount += 1;
        this.serverDiagnosticsSummary.currentSessionCount += 1;

        this.clientDescription = options.clientDescription || new ApplicationDescription({});

        const sessionTimeout = options.sessionTimeout || 1000;

        assert(_.isNumber(sessionTimeout));

        const session = new ServerSession(this, sessionTimeout);

        const key = session.authenticationToken.toString();

        this._sessions[key] = session;

        // see spec OPC Unified Architecture,  Part 2 page 26 Release 1.02
        // TODO : When a Session is created, the Server adds an entry for the Client
        //        in its SessionDiagnosticsArray Variable

        const engine = this;
        session.on("new_subscription", (subscription: Subscription) => {
            engine.serverDiagnosticsSummary.cumulatedSubscriptionCount += 1;
            // add the subscription diagnostics in our subscriptions diagnostics array
        });

        session.on("subscription_terminated", (subscription: Subscription) => {
            // remove the subscription diagnostics in our subscriptions diagnostics array
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

            console.log(
              chalk.cyan("Server: closing SESSION "),
              session.status, chalk.yellow(session.sessionName),
              chalk.cyan(" because of timeout = "), session.sessionTimeout,
              chalk.cyan(" has expired without a keep alive"));

            const channel = session.channel;
            if (channel) {
                console.log(chalk.bgCyan("channel = "), channel.remoteAddress, " port = ", channel.remotePort);
            }

            // If a Server terminates a Session for any other reason, Subscriptions  associated with the Session,
            // are not deleted. => deleteSubscription= false
            this.closeSession(session.authenticationToken, /*deleteSubscription=*/false, /* reason =*/"Timeout");
        });

        return session;
    }

    /**
     * @method closeSession
     * @param authenticationToken
     * @param deleteSubscriptions {Boolean} : true if sessions's subscription shall be deleted
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
    public closeSession(
      authenticationToken: NodeId,
      deleteSubscriptions: boolean, reason: string) {

        const engine = this;

        reason = reason || "CloseSession";
        assert(_.isString(reason));
        assert(reason === "Timeout" || reason === "Terminated" || reason === "CloseSession" || reason === "Forcing");

        debugLog("ServerEngine.closeSession ", authenticationToken.toString(), deleteSubscriptions);

        const session = engine.getSession(authenticationToken);
        if (!session) {
            throw new Error("Internal Error");
        }

        if (!deleteSubscriptions) {

            // Live Subscriptions will not be deleted, but transferred to the orphanPublishEngine
            // until they time out or until a other session transfer them back to it.
            if (!engine._orphanPublishEngine) {

                engine._orphanPublishEngine = new ServerSidePublishEngineForOrphanSubscription(
                  { maxPublishRequestInQueue: 0 });

            }

            debugLog("transferring remaining live subscription to orphanPublishEngine !");
            ServerSidePublishEngine.transferSubscriptionsToOrphan(
              session.publishEngine, engine._orphanPublishEngine);
        }

        session.close(deleteSubscriptions, reason);

        assert(session.status === "closed");

        debugLog(" engine.serverDiagnosticsSummary.currentSessionCount -= 1;");
        engine.serverDiagnosticsSummary.currentSessionCount -= 1;

        // xx //TODO make sure _closedSessions gets cleaned at some point
        // xx self._closedSessions[key] = session;

        // remove sessionDiagnostics from server.ServerDiagnostics.SessionsDiagnosticsSummary.SessionDiagnosticsSummary
        delete engine._sessions[authenticationToken.toString()];
        session.dispose();

    }

    public findSubscription(subscriptionId: number): Subscription | null {

        const engine = this;

        const subscriptions: Subscription[] = [];
        _.map(engine._sessions, (session) => {
            if (subscriptions.length) {
                return;
            }
            const subscription = session.publishEngine.getSubscriptionById(subscriptionId);
            if (subscription) {
                // xx console.log("foundSubscription  ", subscriptionId, " in session", session.sessionName);
                subscriptions.push(subscription);
            }
        });
        if (subscriptions.length) {
            assert(subscriptions.length === 1);
            return subscriptions[0];
        }
        return engine.findOrphanSubscription(subscriptionId);
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
    public transferSubscription(
      session: ServerSession,
      subscriptionId: number,
      sendInitialValues: boolean): TransferResult {

        assert(session instanceof ServerSession);
        assert(_.isNumber(subscriptionId));
        assert(_.isBoolean(sendInitialValues));

        if (subscriptionId <= 0) {
            return new TransferResult({ statusCode: StatusCodes.BadSubscriptionIdInvalid });
        }

        const subscription = this.findSubscription(subscriptionId);
        if (!subscription) {
            return new TransferResult({ statusCode: StatusCodes.BadSubscriptionIdInvalid });
        }
        if (!subscription.$session) {
            return new TransferResult({ statusCode: StatusCodes.BadInternalError });
        }

        // now check that new session has sufficient right
        // if (session.authenticationToken.toString() !== subscription.authenticationToken.toString()) {
        //     console.log("ServerEngine#transferSubscription => BadUserAccessDenied");
        //     return new TransferResult({ statusCode: StatusCodes.BadUserAccessDenied });
        // }
        if (session.publishEngine === subscription.publishEngine) {
            // subscription is already in this session !!
            return new TransferResult({ statusCode: StatusCodes.BadNothingToDo });
        }
        if (session === subscription.$session) {
            // subscription is already in this session !!
            return new TransferResult({ statusCode: StatusCodes.BadNothingToDo });
        }

        const nbSubscriptionBefore = session.publishEngine.subscriptionCount;

        subscription.$session._unexposeSubscriptionDiagnostics(subscription);
        ServerSidePublishEngine.transferSubscription(subscription, session.publishEngine, sendInitialValues);
        subscription.$session = session;

        session._exposeSubscriptionDiagnostics(subscription);

        assert(subscription.publishEngine === session.publishEngine);
        assert(session.publishEngine.subscriptionCount === nbSubscriptionBefore + 1);

        // TODO: If the Server transfers the Subscription to the new Session, the Server shall issue a
        //       StatusChangeNotification notificationMessage with the status code Good_SubscriptionTransferred
        //       to the old Session.

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
    public getSession(
      authenticationToken: NodeId,
      activeOnly?: boolean
    ): ServerSession | null {

        const engine = this;
        if (!authenticationToken ||
          (authenticationToken.identifierType &&
            (authenticationToken.identifierType !== NodeIdType.BYTESTRING))) {
            return null;     // wrong type !
        }
        const key = authenticationToken.toString();
        let session = engine._sessions[key];
        if (!activeOnly && !session) {
            session = engine._closedSessions[key];
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
      nodesToRefresh: any,
      callback: (err: Error | null, dataValues?: DataValue[]) => void
    ): void {

        assert(callback instanceof Function);
        const engine = this;

        const objs: any = {};
        for (const nodeToRefresh of nodesToRefresh) {

            // only consider node  for which the caller wants to read the Value attribute
            // assuming that Value is requested if attributeId is missing,
            if (nodeToRefresh.attributeId && nodeToRefresh.attributeId !== AttributeIds.Value) {
                continue;
            }
            // ... and that are valid object and instances of Variables ...
            const obj = engine.addressSpace!.findNode(nodeToRefresh.nodeId);
            if (!obj || !(obj.nodeClass === NodeClass.Variable)) {
                continue;
            }
            // ... and that have been declared as asynchronously updating
            if (!_.isFunction((obj as any).refreshFunc)) {
                continue;
            }
            const key = obj.nodeId.toString();
            if (objs[key]) {
                continue;
            }

            objs[key] = obj;
        }
        if (Object.keys(objs).length === 0) {
            // nothing to do
            return callback(null, []);
        }
        // perform all asyncRefresh in parallel
        async.map(objs, (obj: BaseNode, inner_callback: DataValueCallback) => {

            if (obj.nodeClass !== NodeClass.Variable) {
                inner_callback(null, new DataValue({
                    statusCode: StatusCodes.BadNodeClassInvalid
                }));
                return;
            }
            (obj as UAVariable).asyncRefresh(inner_callback);

        }, (err?: Error | null, arrResult?: (DataValue | undefined)[]) => {
            callback(err || null, arrResult as DataValue[]);
        });
    }

    private _exposeSubscriptionDiagnostics(subscription: Subscription): void {

        debugLog("ServerEngine#_exposeSubscriptionDiagnostics");
        const subscriptionDiagnosticsArray = this._getServerSubscriptionDiagnosticsArray();
        const subscriptionDiagnostics = subscription.subscriptionDiagnostics;
        assert((subscriptionDiagnostics as any).$subscription === subscription);
        assert(subscriptionDiagnostics instanceof SubscriptionDiagnosticsDataType);

        if (subscriptionDiagnostics && subscriptionDiagnosticsArray) {
            addElement(subscriptionDiagnostics, subscriptionDiagnosticsArray);
        }
    }

    private _unexposeSubscriptionDiagnostics(subscription: Subscription) {

        const subscriptionDiagnosticsArray = this._getServerSubscriptionDiagnosticsArray();
        const subscriptionDiagnostics = subscription.subscriptionDiagnostics;
        assert(subscriptionDiagnostics instanceof SubscriptionDiagnosticsDataType);
        if (subscriptionDiagnostics && subscriptionDiagnosticsArray) {

            const node = (subscriptionDiagnosticsArray as any)[subscription.id];
            removeElement(subscriptionDiagnosticsArray, subscriptionDiagnostics);
            assert(!(subscriptionDiagnosticsArray as any)[subscription.id],
              " subscription node must have been removed from subscriptionDiagnosticsArray");
        }
        debugLog("ServerEngine#_unexposeSubscriptionDiagnostics");
    }

    /**
     * create a new subscription
     * @return {Subscription}
     */
    private _createSubscriptionOnSession(
      session: ServerSession,
      request: CreateSubscriptionRequestLike
    ) {

        assert(request.hasOwnProperty("requestedPublishingInterval")); // Duration
        assert(request.hasOwnProperty("requestedLifetimeCount"));      // Counter
        assert(request.hasOwnProperty("requestedMaxKeepAliveCount"));  // Counter
        assert(request.hasOwnProperty("maxNotificationsPerPublish"));  // Counter
        assert(request.hasOwnProperty("publishingEnabled"));           // Boolean
        assert(request.hasOwnProperty("priority"));                    // Byte

        const subscription = new Subscription({
            id: _get_next_subscriptionId(),
            lifeTimeCount: request.requestedLifetimeCount,
            maxKeepAliveCount: request.requestedMaxKeepAliveCount,
            maxNotificationsPerPublish: request.maxNotificationsPerPublish,
            priority: request.priority || 0,
            publishEngine: session.publishEngine, //
            publishingEnabled: request.publishingEnabled,
            publishingInterval: request.requestedPublishingInterval,
            // -------------------
            sessionId: NodeId.nullNodeId
        });

        // add subscriptionDiagnostics
        this._exposeSubscriptionDiagnostics(subscription);

        assert(subscription.publishEngine === session.publishEngine);
        session.publishEngine.add_subscription(subscription);

        const engine = this;
        subscription.once("terminated", function(this: Subscription) {
            engine._unexposeSubscriptionDiagnostics(this);
        });

        return subscription;
    }

    private __findObject(nodeId: NodeIdLike): BaseNode {
        const engine = this;
        nodeId = resolveNodeId(nodeId);
        assert(nodeId instanceof NodeId);
        return engine.addressSpace!.findNode(nodeId)!;
    }

    private _readSingleNode(
      context: SessionContext,
      nodeToRead: ReadValueIdOptions,
      timestampsToReturn?: TimestampsToReturn
    ): DataValue {

        assert(context instanceof SessionContext);
        const engine = this;
        const nodeId = nodeToRead.nodeId!;
        const attributeId = nodeToRead.attributeId!;
        const indexRange = nodeToRead.indexRange;
        const dataEncoding = nodeToRead.dataEncoding;

        if (timestampsToReturn === TimestampsToReturn.Invalid) {
            return new DataValue({ statusCode: StatusCodes.BadTimestampsToReturnInvalid });
        }

        timestampsToReturn = (timestampsToReturn !== undefined) ? timestampsToReturn : TimestampsToReturn.Neither;

        const obj = engine.__findObject(nodeId!);

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
            try {
                dataValue = obj.readAttribute(context, attributeId, indexRange, dataEncoding);
                assert(dataValue.statusCode instanceof StatusCode);
                if (!dataValue.isValid()) {
                    console.log("Invalid value for node ", obj.nodeId.toString(), obj.browseName.toString());
                }

            } catch (err) {
                console.log(" Internal error reading  NodeId       ", obj.nodeId.toString());
                console.log("                         AttributeId  ", attributeId.toString());
                console.log("                        ", err.message);
                console.log("                        ", err.stack);
                return new DataValue({ statusCode: StatusCodes.BadInternalError });
            }

            // Xx console.log(dataValue.toString());

            dataValue = apply_timestamps(dataValue, timestampsToReturn, attributeId);

            return dataValue;
        }
    }

    private _historyReadSingleNode(
      context: SessionContext,
      nodeToRead: HistoryReadValueId,
      historyReadDetails: HistoryReadDetails,
      timestampsToReturn: TimestampsToReturn,
      callback: Callback<HistoryReadResult>
    ): void {

        assert(context instanceof SessionContext);
        assert(callback instanceof Function);

        const nodeId = nodeToRead.nodeId;
        const indexRange = nodeToRead.indexRange;
        const dataEncoding = nodeToRead.dataEncoding;
        const continuationPoint = nodeToRead.continuationPoint;

        timestampsToReturn = (_.isObject(timestampsToReturn)) ? timestampsToReturn : TimestampsToReturn.Neither;

        const obj = this.__findObject(nodeId) as UAVariable;

        if (!obj) {
            // may be return BadNodeIdUnknown in dataValue instead ?
            // Object Not Found
            callback(null, new HistoryReadResult({ statusCode: StatusCodes.BadNodeIdUnknown }));
            return;

        } else {

            if (!obj.historyRead) {
                // note : Object and View may also support historyRead to provide Event historical data
                //        todo implement historyRead for Object and View
                const msg = " this node doesn't provide historyRead! probably not a UAVariable\n "
                  + obj.nodeId.toString() + " " + obj.browseName.toString() + "\n"
                  + "with " + nodeToRead.toString() + "\n"
                  + "HistoryReadDetails " + historyReadDetails.toString();
                if (doDebug) {
                    console.log(chalk.cyan("ServerEngine#_historyReadSingleNode "),
                      chalk.white.bold(msg));
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
              continuationPoint,
              (err: Error | null, result?: HistoryReadResult) => {
                  if (err || !result) {
                      return callback(err);
                  }
                  assert(result!.statusCode instanceof StatusCode);
                  assert(result!.isValid());
                  // result = apply_timestamps(result, timestampsToReturn, attributeId);
                  callback(err, result);
              });
        }
    }

    /**
     */
    private __internal_bindMethod(
      nodeId: NodeId,
      func: MethodFunctor
    ) {

        const engine = this;
        assert(_.isFunction(func));
        assert(nodeId instanceof NodeId);

        const methodNode = engine.addressSpace!.findNode(nodeId)! as UAMethod;
        if (!methodNode) {
            return;
        }
        if (methodNode && methodNode.bindMethod) {
            methodNode.bindMethod(func);
        } else {
            console.log(
              chalk.yellow("WARNING:  cannot bind a method with id ") +
              chalk.cyan(nodeId.toString()) +
              chalk.yellow(". please check your nodeset.xml file or add this node programmatically"));

            console.log(trace_from_this_projet_only());
        }
    }

    private _getServerSubscriptionDiagnosticsArray()
      : UADynamicVariableArray<SubscriptionDiagnosticsDataType> | null {

        if (!this.addressSpace) {
            if (doDebug) {
                console.warn("ServerEngine#_getServerSubscriptionDiagnosticsArray : no addressSpace");
            }
            return null; // no addressSpace
        }
        const subscriptionDiagnosticsType = this.addressSpace.findVariableType("SubscriptionDiagnosticsType");
        if (!subscriptionDiagnosticsType) {
            if (doDebug) {
                console.warn("ServerEngine#_getServerSubscriptionDiagnosticsArray " +
                  ": cannot find SubscriptionDiagnosticsType");
            }
        }

        // SubscriptionDiagnosticsArray = i=2290
        const subscriptionDiagnosticsArray = this.addressSpace.findNode(
          makeNodeId(VariableIds.Server_ServerDiagnostics_SubscriptionDiagnosticsArray))!;

        return subscriptionDiagnosticsArray as UADynamicVariableArray<SubscriptionDiagnosticsDataType>;
    }
}
