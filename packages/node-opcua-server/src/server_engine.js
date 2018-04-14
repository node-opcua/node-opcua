/* global require */
"use strict";
/**
 * @module opcua.server
 */


const _ = require("underscore");
const assert = require("node-opcua-assert").assert;
const async = require("async");
const util = require("util");
const EventEmitter = require("events").EventEmitter;

const SessionContext = require("node-opcua-address-space").SessionContext;

const NodeId = require("node-opcua-nodeid").NodeId;
const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
const makeNodeId = require("node-opcua-nodeid").makeNodeId;
const NodeIdType = require("node-opcua-nodeid").NodeIdType;
const NumericRange = require("node-opcua-numeric-range").NumericRange;
const BrowseDirection = require("node-opcua-data-model").BrowseDirection;
const BrowseResult = require("node-opcua-service-browse").BrowseResult;

const ReadRequest = require("node-opcua-service-read").ReadRequest;

require("node-opcua-common");

const read_service = require("node-opcua-service-read");
const AttributeIds = require("node-opcua-data-model").AttributeIds;
const TimestampsToReturn = read_service.TimestampsToReturn;

const UAVariable = require("node-opcua-address-space").UAVariable;
const ServerSidePublishEngine = require("./server_publish_engine").ServerSidePublishEngine;

const historizing_service = require("node-opcua-service-history");
const HistoryReadRequest = historizing_service.HistoryReadRequest;
const HistoryReadDetails = historizing_service.HistoryReadDetails;
const HistoryReadResult = historizing_service.HistoryReadResult;

const DataValue = require("node-opcua-data-value").DataValue;
const Variant = require("node-opcua-variant").Variant;
const DataType = require("node-opcua-variant").DataType;
const VariantArrayType = require("node-opcua-variant").VariantArrayType;
const isValidVariant = require("node-opcua-variant").isValidVariant;


const StatusCodes = require("node-opcua-status-code").StatusCodes;
const StatusCode = require("node-opcua-status-code").StatusCode;


require("node-opcua-common");

const address_space = require("node-opcua-address-space");
const AddressSpace = address_space.AddressSpace;

const generate_address_space = require("node-opcua-address-space").generate_address_space;

const ServerSession = require("./server_session").ServerSession;

const VariableIds = require("node-opcua-constants").VariableIds;
const MethodIds = require("node-opcua-constants").MethodIds;

const ReferenceType = require("node-opcua-address-space").ReferenceType;


const ServerState = require("node-opcua-common").ServerState;
const ServerStatus = require("node-opcua-common").ServerStatus;
const ServerDiagnosticsSummary = require("node-opcua-common").ServerDiagnosticsSummary;

const endpoints_service = require("node-opcua-service-endpoints");
const ApplicationDescription = endpoints_service.ApplicationDescription;

const nodesets = require("node-opcua-nodesets");
exports.standard_nodeset_file = nodesets.standard_nodeset_file;
exports.di_nodeset_filename = nodesets.di_nodeset_filename;
exports.adi_nodeset_filename = nodesets.adi_nodeset_filename;
const mini_nodeset_filename = require("node-opcua-address-space/test_helpers/get_mini_address_space").mini_nodeset_filename;
exports.mini_nodeset_filename = mini_nodeset_filename;


const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const doDebug = require("node-opcua-debug").checkDebugFlag(__filename);

const ServerCapabilities = require("./server_capabilities").ServerCapabilities;
const HistoryServerCapabilities = require("./history_server_capabilities").HistoryServerCapabilities;

const eoan = require("node-opcua-address-space");


/**
 * @class ServerEngine
 * @extends EventEmitter
 * @uses ServerSidePublishEngine
 * @param options {Object}
 * @param options.buildInfo
 * @param [options.isAuditing = false ] {Boolean}
 * @param [options.serverCapabilities]
 * @param [options.serverCapabilities.serverProfileArray]
 * @param [options.serverCapabilities.localeIdArray]
 * @param options.applicationUri {String} the application URI.
 * @param [options.historyServerCapabilities]
 * @param [options.serverDiagnosticsEnabled = true] set to true to enable serverDiagnostics
 *
 * @constructor
 */
function ServerEngine(options) {

    options = options || {};
    options.buildInfo = options.buildInfo || {};

    EventEmitter.apply(this, arguments);
    const engine = this;
    ServerEngine.registry.register(engine);

    engine._sessions = {};
    engine._closedSessions = {};
    engine._orphanPublishEngine = null; // will be constructed on demand

    engine.isAuditing = _.isBoolean(options.isAuditing) ? options.isAuditing : false;

    options.buildInfo.buildDate = options.buildInfo.buildDate || new Date();
    // ---------------------------------------------------- ServerStatus
    engine.serverStatus = new ServerStatus({
        startTime: new Date(),
        currentTime: new Date(),
        state: ServerState.NoConfiguration,
        buildInfo: options.buildInfo,
        secondsTillShutdown: 0,
        shutdownReason: {text: ""}
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

    engine.serverCapabilities = new ServerCapabilities(options.serverCapabilities);
    engine.historyServerCapabilities = new HistoryServerCapabilities(options.historyServerCapabilities);

    // --------------------------------------------------- serverDiagnosticsSummary extension Object
    engine.serverDiagnosticsSummary = new ServerDiagnosticsSummary({});
    assert(engine.serverDiagnosticsSummary.hasOwnProperty("currentSessionCount"));

    // note spelling is different for serverDiagnosticsSummary.currentSubscriptionCount
    //      and sessionDiagnostics.currentSubscriptionsCount ( with an s)
    assert(engine.serverDiagnosticsSummary.hasOwnProperty("currentSubscriptionCount"));

    engine.serverDiagnosticsSummary.__defineGetter__("currentSubscriptionCount", function () {
        // currentSubscriptionCount returns the total number of subscriptions
        // that are currently active on all sessions
        let counter = 0;
        _.values(engine._sessions).forEach(function (session) {
            counter += session.currentSubscriptionCount;
        });
        return counter;
    });

    engine.status = "creating";

    engine.setServerState(ServerState.NoConfiguration);

    engine.addressSpace = null;

    engine._shutdownTask = [];

    engine._applicationUri = options.applicationUri || "<unset _applicationUri>";

    options.serverDiagnosticsEnabled = options.hasOwnProperty("serverDiagnosticsEnable")
                                            ? options.serverDiagnosticsEnabled : true;
    engine.serverDiagnosticsEnabled = options.serverDiagnosticsEnabled;

}

util.inherits(ServerEngine, EventEmitter);
const ObjectRegistry = require("node-opcua-object-registry").ObjectRegistry;
ServerEngine.registry = new ObjectRegistry();

ServerEngine.prototype.dispose = function () {

    const engine = this;
    engine.addresSpaec = null;

    assert(Object.keys(engine._sessions).length === 0, "ServerEngine#_sessions not empty");
    engine._sessions = {};

    // todo fix me
    engine._closedSessions = {};
    assert(Object.keys(engine._closedSessions).length === 0, "ServerEngine#_closedSessions not empty");
    engine._closedSessions = {};

    if (engine._orphanPublishEngine) {
        engine._orphanPublishEngine.dispose();
        engine._orphanPublishEngine = null;
    }

    engine._shutdownTask = null;
    engine.serverStatus = null;
    engine.status = "disposed";

    engine.removeAllListeners();

    ServerEngine.registry.unregister(engine);
};
ServerEngine.prototype.__defineGetter__("startTime", function () {
    const engine = this;
    return engine.serverStatus.startTime;
});

ServerEngine.prototype.__defineGetter__("currentTime", function () {
    const engine = this;
    return engine.serverStatus.currentTime;
});

ServerEngine.prototype.__defineGetter__("buildInfo", function () {
    const engine = this;
    return engine.serverStatus.buildInfo;
});
/**
 * register a function that will be called when the server will perform its shut down.
 * @method registerShutdownTask
 */
ServerEngine.prototype.registerShutdownTask = function (task) {
    const engine = this;
    assert(_.isFunction(task));
    engine._shutdownTask.push(task);

};

function shutdownAndDisposeAddressSpace() {
    /* jshint validthis:true */
    const engine = this;
    if (engine.addressSpace) {
        assert(engine.addressSpace instanceof AddressSpace);
        engine.addressSpace.shutdown();
        engine.addressSpace.dispose();
        delete engine.addressSpace;
    }
}

/**
 * @method shutdown
 */
ServerEngine.prototype.shutdown = function () {


    debugLog("ServerEngine#shutdown");

    const engine = this;

    engine.status = "shutdown";
    engine.setServerState(ServerState.Shutdown);

    // delete any existing sessions
    const tokens = Object.keys(engine._sessions).map(function (key) {
        const session = engine._sessions[key];
        return session.authenticationToken;
    });

    // delete and close any orphan subscription
    if (engine._orphanPublishEngine) {
        engine._orphanPublishEngine.shutdown();
    }


    //xx console.log("xxxxxxxxx ServerEngine.shutdown must terminate "+ tokens.length," sessions");

    tokens.forEach(function (token) {
        engine.closeSession(token, true, "Terminated");
    });

    // all sessions must have been terminated
    assert(engine.currentSessionCount === 0);


    // all subscriptions must have been terminated
    assert(engine.currentSubscriptionCount === 0, "all subscriptions must have been terminated");

    engine._shutdownTask.push(shutdownAndDisposeAddressSpace);

    // perform registerShutdownTask
    engine._shutdownTask.forEach(function (task) {
        task.call(engine);
    });

    engine.dispose();
};

/**
 * the number of active sessions
 * @property currentSessionCount
 * @type {Number}
 */
ServerEngine.prototype.__defineGetter__("currentSessionCount", function () {
    const engine = this;
    return engine.serverDiagnosticsSummary.currentSessionCount;
});

/**
 * the cumulated number of sessions that have been opened since this object exists
 * @property cumulatedSessionCount
 * @type {Number}
 */
ServerEngine.prototype.__defineGetter__("cumulatedSessionCount", function () {
    const engine = this;
    return engine.serverDiagnosticsSummary.cumulatedSessionCount;
});

/**
 * the number of active subscriptions.
 * @property currentSubscriptionCount
 * @type {Number}
 */
ServerEngine.prototype.__defineGetter__("currentSubscriptionCount", function () {
    const engine = this;
    return engine.serverDiagnosticsSummary.currentSubscriptionCount;
});
/**
 * the cumulated number of subscriptions that have been created since this object exists
 * @property cumulatedSubscriptionCount
 * @type {Number}
 */
ServerEngine.prototype.__defineGetter__("cumulatedSubscriptionCount", function () {
    const engine = this;
    return engine.serverDiagnosticsSummary.cumulatedSubscriptionCount;
});

ServerEngine.prototype.__defineGetter__("rejectedSessionCount", function () {
    const engine = this;
    return engine.serverDiagnosticsSummary.rejectedSessionCount;
});

ServerEngine.prototype.__defineGetter__("rejectedRequestsCount", function () {
    const engine = this;
    return engine.serverDiagnosticsSummary.rejectedRequestsCount;
});

ServerEngine.prototype.__defineGetter__("sessionAbortCount", function () {
    const engine = this;
    return engine.serverDiagnosticsSummary.sessionAbortCount;
});
ServerEngine.prototype.__defineGetter__("sessionTimeoutCount", function () {
    const engine = this;
    return engine.serverDiagnosticsSummary.sessionTimeoutCount;
});

ServerEngine.prototype.__defineGetter__("publishingIntervalCount", function () {
    const engine = this;
    return engine.serverDiagnosticsSummary.publishingIntervalCount;
});


/**
 * @method secondsTillShutdown
 * @return {UInt32} the approximate number of seconds until the server will be shut down. The
 * value is only relevant once the state changes into SHUTDOWN.
 */
ServerEngine.prototype.secondsTillShutdown = function () {
    // ToDo: implement a correct solution here
    return 0;
};


const CallMethodResult = require("node-opcua-service-call").CallMethodResult;

// binding methods
function getMonitoredItemsId(inputArguments, context, callback) {


    const engine = this; // ServerEngine

    assert(_.isArray(inputArguments));
    assert(_.isFunction(callback));

    assert(context.hasOwnProperty("session"), " expecting a session id in the context object");

    const session = context.session;
    if (!session) {
        return callback(null, {statusCode: StatusCodes.BadInternalError});
    }

    const subscriptionId = inputArguments[0].value;
    const subscription = session.getSubscription(subscriptionId);
    if (!subscription) {
        // subscription may belongs to a different session  that ours
        if (engine.findSubscription(subscriptionId)) {
            // if yes, then access to  Subscription data should be denied
            return callback(null, {statusCode: StatusCodes.BadUserAccessDenied});
        }

        return callback(null, {statusCode: StatusCodes.BadSubscriptionIdInvalid});
    }
    const result = subscription.getMonitoredItems();
    assert(result.statusCode);
    assert(_.isArray(result.serverHandles));
    assert(_.isArray(result.clientHandles));
    assert(result.serverHandles.length === result.clientHandles.length);
    const callMethodResult = new CallMethodResult({
        statusCode: result.statusCode,
        outputArguments: [
            {dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: result.serverHandles},
            {dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: result.clientHandles}
        ]
    });
    callback(null, callMethodResult);

}

/**
 * the name of the server
 * @property serverName
 * @type String
 */
ServerEngine.prototype.__defineGetter__("serverName", function () {
    const engine = this;
    return engine.serverStatus.buildInfo.productName;
});

/**
 * the server urn
 * @property serverNameUrn
 * @type String
 */
ServerEngine.prototype.__defineGetter__("serverNameUrn", function () {
    const engine = this;
    return engine._applicationUri;
});

/**
 * the urn of the server namespace
 * @property serverNamespaceName
 * @type String
 */
ServerEngine.prototype.__defineGetter__("serverNamespaceUrn", function () {
    const engine = this;
    return engine._applicationUri; // "urn:" + engine.serverName;
});


ServerEngine.prototype.setServerState = function (serverState) {
    const engine = this;
    assert(serverState !== null && serverState !== undefined);
    engine.serverStatus.state = serverState;
};

ServerEngine.prototype.getServerDiagnosticsEnabledFlag = function () {
    const engine = this;
    const serverDiagnostics = engine.server.getComponentByName("ServerDiagnostics");
    if (!serverDiagnostics) {
        return false;
    }
    return serverDiagnostics.readValue().value.value;
};

ServerEngine.prototype.getServerDiagnosticsEnabledFlag = function () {
    const engine = this;
    const serverDiagnostics = engine.getComponentByName("ServerDiagnostics");
    if (!serverDiagnostics) {
        return false;
    }
    return serverDiagnostics.readValue().value.value;
};

/**
 * @method initialize
 * @async
 *
 * @param options {Object}
 * @param options.nodeset_filename {String} - [option](default : 'mini.Node.Set2.xml' )
 * @param callback
 */
ServerEngine.prototype.initialize = function (options, callback) {

    const engine = this;
    assert(!engine.addressSpace); // check that 'initialize' has not been already called

    engine.status = "initializing";

    options = options || {};
    assert(_.isFunction(callback));

    options.nodeset_filename = options.nodeset_filename || nodesets.standard_nodeset_file;

    const startTime = new Date();

    debugLog("Loading ", options.nodeset_filename, "...");

    engine.addressSpace = new AddressSpace();

    // register namespace 1 (our namespace);
    const serverNamespaceIndex = engine.addressSpace.registerNamespace(engine.serverNamespaceUrn);
    assert(serverNamespaceIndex === 1);

    generate_address_space(engine.addressSpace, options.nodeset_filename, function () {

        const endTime = new Date();
        debugLog("Loading ", options.nodeset_filename, " done : ", endTime - startTime, " ms");

        function findObjectNodeId(name) {
            const obj = engine.addressSpace.findNode(name);
            return obj ? obj.nodeId : null;
        }

        engine.FolderTypeId = findObjectNodeId("FolderType");
        engine.BaseObjectTypeId = findObjectNodeId("BaseObjectType");
        engine.BaseDataVariableTypeId = findObjectNodeId("BaseDataVariableType");

        engine.rootFolder = engine.addressSpace.findNode("RootFolder");
        assert(engine.rootFolder && engine.rootFolder.readAttribute, " must provide a root folder and expose a readAttribute method");

        engine.setServerState(ServerState.Running);

        function bindVariableIfPresent(nodeId, opts) {
            assert(nodeId instanceof NodeId);
            assert(!nodeId.isEmpty());
            const obj = engine.addressSpace.findNode(nodeId);
            if (obj) {
                __bindVariable(engine, nodeId, opts);
            }
            return obj;
        }


        // -------------------------------------------- install default get/put handler
        const server_NamespaceArray_Id = makeNodeId(VariableIds.Server_NamespaceArray); // ns=0;i=2255
        bindVariableIfPresent(server_NamespaceArray_Id, {
            get: function () {
                return new Variant({
                    dataType: DataType.String,
                    arrayType: VariantArrayType.Array,
                    value: engine.addressSpace.getNamespaceArray()
                });
            },
            set: null // read only
        });

        const server_NameUrn_var = new Variant({
            dataType: DataType.String,
            arrayType: VariantArrayType.Array,
            value: [
                engine.serverNameUrn // this is us !
            ]
        });
        const server_ServerArray_Id = makeNodeId(VariableIds.Server_ServerArray); // ns=0;i=2254

        bindVariableIfPresent(server_ServerArray_Id, {
            get: function () {
                return server_NameUrn_var;
            },
            set: null // read only
        });

        function bindStandardScalar(id, dataType, func, setter_func) {

            assert(_.isNumber(id), "expecting id to be a number");
            assert(_.isFunction(func));
            assert(_.isFunction(setter_func) || !setter_func);
            assert(dataType !== null); // check invalid dataType

            let setter_func2 = null;
            if (setter_func) {
                setter_func2 = function (variant) {
                    const variable2 = !!variant.value;
                    setter_func(variable2);
                    return StatusCodes.Good;
                };
            }

            const nodeId = makeNodeId(id);

            // make sur the provided function returns a valid value for the variant type
            // This test may not be exhaustive but it will detect obvious mistakes.
            assert(isValidVariant(VariantArrayType.Scalar, dataType, func()));
            return bindVariableIfPresent(nodeId, {
                get: function () {
                    return new Variant({
                        dataType: dataType,
                        arrayType: VariantArrayType.Scalar,
                        value: func()
                    });
                },
                set: setter_func2

            });
        }

        function bindStandardArray(id, variantDataType, dataType, func) {

            assert(_.isFunction(func));
            assert(variantDataType !== null); // check invalid dataType

            const nodeId = makeNodeId(id);

            // make sur the provided function returns a valid value for the variant type
            // This test may not be exhaustive but it will detect obvious mistakes.
            assert(isValidVariant(VariantArrayType.Array, dataType, func()));

            bindVariableIfPresent(nodeId, {
                get: function () {
                    const value = func();
                    assert(_.isArray(value));
                    return new Variant({
                        dataType: variantDataType,
                        arrayType: VariantArrayType.Array,
                        value: value
                    });
                },
                set: null // read only
            });
        }

        bindStandardScalar(VariableIds.Server_ServiceLevel,
            DataType.Byte, function () {
                return 255;
            });

        bindStandardScalar(VariableIds.Server_Auditing,
            DataType.Boolean, function () {
                return engine.isAuditing;
            });


        function bindServerDiagnostics() {

            bindStandardScalar(VariableIds.Server_ServerDiagnostics_EnabledFlag,
                DataType.Boolean, function () {
                    return engine.serverDiagnosticsEnabled;
                }, function (newFlag) {
                    engine.serverDiagnosticsEnabled = newFlag;
                });

            const serverDiagnosticsSummary = engine.addressSpace.findNode(makeNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary));
            if (serverDiagnosticsSummary) {
                serverDiagnosticsSummary.bindExtensionObject(engine.serverDiagnosticsSummary);
                engine.serverDiagnosticsSummary = serverDiagnosticsSummary.$extensionObject;
            }

        }

        function bindServerStatus() {

            const serverStatusNode = engine.addressSpace.findNode(makeNodeId(VariableIds.Server_ServerStatus));
            if (!serverStatusNode) {
                return;
            }
            if (serverStatusNode) {
                serverStatusNode.bindExtensionObject(engine.serverStatus);
                //xx serverStatusNode.updateExtensionObjectPartial(self.serverStatus);
                //xx self.serverStatus = serverStatusNode.$extensionObject;
                serverStatusNode.minimumSamplingInterval = 1000;
            }

            const currentTimeNode = engine.addressSpace.findNode(makeNodeId(VariableIds.Server_ServerStatus_CurrentTime));
            if (currentTimeNode) {
                currentTimeNode.minimumSamplingInterval = 1000;
            }
            const secondsTillShutdown = engine.addressSpace.findNode(makeNodeId(VariableIds.Server_ServerStatus_SecondsTillShutdown));
            if (secondsTillShutdown) {
                secondsTillShutdown.minimumSamplingInterval = 1000;
            }

            assert(serverStatusNode.$extensionObject);

            serverStatusNode.$extensionObject = new Proxy(serverStatusNode.$extensionObject, {
                get: function (target, prop) {
                    if (prop === "currentTime") {
                        serverStatusNode.currentTime.touchValue();
                        return new Date();
                    } else if (prop === "secondsTillShutdown") {
                        serverStatusNode.secondsTillShutdown.touchValue();
                        return engine.secondsTillShutdown();
                    }
                    return target[prop];
                }
            });

        }

        function bindServerCapabilities() {

            bindStandardArray(VariableIds.Server_ServerCapabilities_ServerProfileArray,
                DataType.String, "String", function () {
                    return engine.serverCapabilities.serverProfileArray;
                });

            bindStandardArray(VariableIds.Server_ServerCapabilities_LocaleIdArray,
                DataType.String, "LocaleId", function () {
                    return engine.serverCapabilities.localeIdArray;
                });

            bindStandardScalar(VariableIds.Server_ServerCapabilities_MinSupportedSampleRate,
                DataType.Double, function () {
                    return engine.serverCapabilities.minSupportedSampleRate;
                });

            bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxBrowseContinuationPoints,
                DataType.UInt16, function () {
                    return engine.serverCapabilities.maxBrowseContinuationPoints;
                });

            bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxQueryContinuationPoints,
                DataType.UInt16, function () {
                    return engine.serverCapabilities.maxQueryContinuationPoints;
                });

            bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxHistoryContinuationPoints,
                DataType.UInt16, function () {
                    return engine.serverCapabilities.maxHistoryContinuationPoints;
                });


            // added by DI : Server-specific period of time in milliseconds until the Server will revoke a lock.
            //TODO bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxInactiveLockTime,
            //TODO     DataType.UInt16, function () {
            //TODO         return self.serverCapabilities.maxInactiveLockTime;
            //TODO });


            bindStandardArray(VariableIds.Server_ServerCapabilities_SoftwareCertificates,
                DataType.ByteString, "SoftwareCertificates", function () {
                    return engine.serverCapabilities.softwareCertificates;
                });

            bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxArrayLength,
                DataType.UInt32, function () {
                    return engine.serverCapabilities.maxArrayLength;
                });

            bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxStringLength,
                DataType.UInt32, function () {
                    return engine.serverCapabilities.maxStringLength;
                });

            bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxByteStringLength,
                DataType.UInt32, function () {
                    return engine.serverCapabilities.maxByteStringLength;
                });

            function bindOperationLimits(operationLimits) {

                assert(_.isObject(operationLimits));

                function upperCaseFirst(str) {
                    return str.slice(0, 1).toUpperCase() + str.slice(1);
                }

                //Xx bindStandardArray(VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerWrite,
                //Xx     DataType.UInt32, "UInt32", function () {  return operationLimits.maxNodesPerWrite;  });
                const keys = Object.keys(operationLimits);

                keys.forEach(function (key) {

                    const uid = "Server_ServerCapabilities_OperationLimits_" + upperCaseFirst(key);
                    const nodeId = makeNodeId(VariableIds[uid]);
                    //xx console.log("xxx Binding ".bgCyan,uid,nodeId.toString());
                    assert(!nodeId.isEmpty());

                    bindStandardScalar(VariableIds[uid],
                        DataType.UInt32, function () {
                            return operationLimits[key];
                        });
                });
            }

            bindOperationLimits(engine.serverCapabilities.operationLimits);

        }

        function bindHistoryServerCapabilities() {

            bindStandardScalar(VariableIds.HistoryServerCapabilities_MaxReturnDataValues,
                DataType.UInt32, function () {
                    return engine.historyServerCapabilities.maxReturnDataValues;
                });

            bindStandardScalar(VariableIds.HistoryServerCapabilities_MaxReturnEventValues,
                DataType.UInt32, function () {
                    return engine.historyServerCapabilities.maxReturnEventValues;
                });

            bindStandardScalar(VariableIds.HistoryServerCapabilities_AccessHistoryDataCapability,
                DataType.Boolean, function () {
                    return engine.historyServerCapabilities.accessHistoryDataCapability;
                });
            bindStandardScalar(VariableIds.HistoryServerCapabilities_AccessHistoryEventsCapability,
                DataType.Boolean, function () {
                    return engine.historyServerCapabilities.accessHistoryEventsCapability;
                });
            bindStandardScalar(VariableIds.HistoryServerCapabilities_InsertDataCapability,
                DataType.Boolean, function () {
                    return engine.historyServerCapabilities.insertDataCapability;
                });
            bindStandardScalar(VariableIds.HistoryServerCapabilities_ReplaceDataCapability,
                DataType.Boolean, function () {
                    return engine.historyServerCapabilities.replaceDataCapability;
                });
            bindStandardScalar(VariableIds.HistoryServerCapabilities_UpdateDataCapability,
                DataType.Boolean, function () {
                    return engine.historyServerCapabilities.updateDataCapability;
                });

            bindStandardScalar(VariableIds.HistoryServerCapabilities_InsertEventCapability,
                DataType.Boolean, function () {
                    return engine.historyServerCapabilities.insertEventCapability;
                });

            bindStandardScalar(VariableIds.HistoryServerCapabilities_ReplaceEventCapability,
                DataType.Boolean, function () {
                    return engine.historyServerCapabilities.replaceEventCapability;
                });

            bindStandardScalar(VariableIds.HistoryServerCapabilities_UpdateEventCapability,
                DataType.Boolean, function () {
                    return engine.historyServerCapabilities.updateEventCapability;
                });

            bindStandardScalar(VariableIds.HistoryServerCapabilities_DeleteEventCapability,
                DataType.Boolean, function () {
                    return engine.historyServerCapabilities.deleteEventCapability;
                });


            bindStandardScalar(VariableIds.HistoryServerCapabilities_DeleteRawCapability,
                DataType.Boolean, function () {
                    return engine.historyServerCapabilities.deleteRawCapability;
                });

            bindStandardScalar(VariableIds.HistoryServerCapabilities_DeleteAtTimeCapability,
                DataType.Boolean, function () {
                    return engine.historyServerCapabilities.deleteAtTimeCapability;
                });

            bindStandardScalar(VariableIds.HistoryServerCapabilities_InsertAnnotationCapability,
                DataType.Boolean, function () {
                    return engine.historyServerCapabilities.insertAnnotationCapability;
                });


        }

        bindServerDiagnostics();

        bindServerStatus();

        bindServerCapabilities();

        bindHistoryServerCapabilities();

        function bindExtraStuff() {
            // mainly for compliance

            //The version number for the data type description. i=104
            bindStandardScalar(VariableIds.DataTypeDescriptionType_DataTypeVersion,
                DataType.UInt16, function () {
                    return 0.0;
                });

            // i=111
            bindStandardScalar(VariableIds.ModellingRuleType_NamingRule,
                DataType.UInt16, function () {
                    return 0.0;
                });

            // i=112
            bindStandardScalar(VariableIds.ModellingRule_Mandatory_NamingRule,
                DataType.UInt16, function () {
                    return 0.0;
                });

            // i=113
            bindStandardScalar(VariableIds.ModellingRule_Optional_NamingRule,
                DataType.UInt16, function () {
                    return 0.0;
                });
        }

        bindExtraStuff();

        engine.__internal_bindMethod(makeNodeId(MethodIds.Server_GetMonitoredItems), getMonitoredItemsId.bind(engine));

        // fix getMonitoredItems.outputArguments arrayDimensions
        (function fixGetMonitoredItemArgs() {
            const objects = engine.addressSpace.rootFolder.objects;
            if (!objects || objects.server || objects.server.getMonitoredItems) {
                return;
            }
            const outputArguments = objects.server.getMonitoredItems.outputArguments;
            const dataValue = outputArguments.readValue();
            assert(dataValue.value.value[0].arrayDimensions.length === 1 && dataValue.value.value[0].arrayDimensions[0] === 0);
            assert(dataValue.value.value[1].arrayDimensions.length === 1 && dataValue.value.value[1].arrayDimensions[0] === 0);
        })();

        function prepareServerDiagnostics() {

            const addressSpace = engine.addressSpace;

            if (!addressSpace.rootFolder.objects) {
                return;
            }
            const server = addressSpace.rootFolder.objects.server;

            if (!server) {
                return;
            }

            // create SessionsDiagnosticsSummary
            const serverDiagnostics = server.getComponentByName("ServerDiagnostics");
            if (!serverDiagnostics) {
                return;
            }

            const subscriptionDiagnosticsArray = serverDiagnostics.getComponentByName("SubscriptionDiagnosticsArray");
            assert(subscriptionDiagnosticsArray instanceof UAVariable);
            eoan.bindExtObjArrayNode(subscriptionDiagnosticsArray, "SubscriptionDiagnosticsType", "subscriptionId");

            const sessionDiagnosticsArray = serverDiagnostics.getComponentByName("SessionsDiagnosticsSummary").getComponentByName("SessionDiagnosticsArray");
            assert(sessionDiagnosticsArray instanceof UAVariable);
            eoan.bindExtObjArrayNode(sessionDiagnosticsArray, "SessionDiagnosticsVariableType", "sessionId");
        }

        prepareServerDiagnostics();


        engine.status = "initialized";
        setImmediate(callback);
    });
};

require("node-opcua-address-space");

ServerEngine.prototype.__findObject = function (nodeId) {
    const engine = this;
    nodeId = resolveNodeId(nodeId);
    assert(nodeId instanceof NodeId);
    return engine.addressSpace.findNode(nodeId);
};

/**
 *
 * @method browseSingleNode
 * @param nodeId {NodeId|String} : the nodeid of the element to browse
 * @param browseDescription
 * @param browseDescription.browseDirection {BrowseDirection} :
 * @param browseDescription.referenceTypeId {String|NodeId}
 * @param [session] {ServerSession}
 * @return {BrowseResult}
 */
ServerEngine.prototype.browseSingleNode = function (nodeId, browseDescription, session) {
    const engine = this;
    assert(engine.addressSpace instanceof AddressSpace); // initialize not called
    const addressSpace = engine.addressSpace;
    return addressSpace.browseSingleNode(nodeId, browseDescription, session);
};

/**
 *
 * @method browse
 * @param nodesToBrowse {BrowseDescription[]}
 * @param [session] {ServerSession}
 * @return {BrowseResult[]}
 */
ServerEngine.prototype.browse = function (nodesToBrowse, session) {
    const engine = this;
    assert(engine.addressSpace instanceof AddressSpace); // initialize not called
    assert(_.isArray(nodesToBrowse));

    const results = [];
    nodesToBrowse.forEach(function (browseDescription) {


        const nodeId = resolveNodeId(browseDescription.nodeId);

        const r = engine.browseSingleNode(nodeId, browseDescription, session);
        results.push(r);
    });
    return results;
};
const apply_timestamps = require("node-opcua-data-value").apply_timestamps;

/**
 *
 * @method readSingleNode
 * @param context {SessionContext}
 * @param nodeId
 * @param attributeId {AttributeId}
 * @param [timestampsToReturn=TimestampsToReturn.Neither]
 * @return {DataValue}
 */
ServerEngine.prototype.readSingleNode = function (context, nodeId, attributeId, timestampsToReturn) {
    const engine = this;

    return engine._readSingleNode(context,
        {
            nodeId: nodeId,
            attributeId: attributeId
        },
        timestampsToReturn);
};

ServerEngine.prototype._readSingleNode = function (context, nodeToRead, timestampsToReturn) {

    assert(context instanceof SessionContext);
    const engine = this;
    const nodeId = nodeToRead.nodeId;
    const attributeId = nodeToRead.attributeId;
    const indexRange = nodeToRead.indexRange;
    const dataEncoding = nodeToRead.dataEncoding;
    assert(engine.addressSpace instanceof AddressSpace); // initialize not called

    if (timestampsToReturn === TimestampsToReturn.Invalid) {
        return new DataValue({statusCode: StatusCodes.BadTimestampsToReturnInvalid});
    }

    timestampsToReturn = (_.isObject(timestampsToReturn)) ? timestampsToReturn : TimestampsToReturn.Neither;

    const obj = engine.__findObject(nodeId);

    let dataValue;
    if (!obj) {
        // may be return BadNodeIdUnknown in dataValue instead ?
        // Object Not Found
        return new DataValue({statusCode: StatusCodes.BadNodeIdUnknown});
    } else {

        // check access
        //    BadUserAccessDenied
        //    BadNotReadable
        //    invalid attributes : BadNodeAttributesInvalid
        //    invalid range      : BadIndexRangeInvalid
        try {
            dataValue = obj.readAttribute(context, attributeId, indexRange, dataEncoding);
            assert(dataValue.statusCode instanceof StatusCode);
            if(!dataValue.isValid()) {
                console.log("Invalid value for node ",obj.nodeId.toString(),obj.browseName.toString());
            }

        }
        catch (err) {
            console.log(" Internal error reading  NodeId       ", obj.nodeId.toString());
            console.log("                         AttributeId  ", attributeId.toString());
            console.log("                        ", err.message);
            console.log("                        ", err.stack);
            return new DataValue({statusCode: StatusCodes.BadInternalError});
        }

        //Xx console.log(dataValue.toString());

        dataValue = apply_timestamps(dataValue, timestampsToReturn, attributeId);

        return dataValue;
    }
};

/**
 *
 *  @method read
 *  @param readRequest {ReadRequest}
 *  @param readRequest.timestampsToReturn  {TimestampsToReturn}
 *  @param readRequest.nodesToRead
 *  @param readRequest.maxAge {Number} maxAge - must be greater or equal than zero.
 *
 *    Maximum age of the value to be read in milliseconds. The age of the value is based on the difference between the
 *    ServerTimestamp and the time when the  Server starts processing the request. For example if the Client specifies a
 *    maxAge of 500 milliseconds and it takes 100 milliseconds until the Server starts  processing the request, the age
 *    of the returned value could be 600 milliseconds  prior to the time it was requested.
 *    If the Server has one or more values of an Attribute that are within the maximum age, it can return any one of the
 *    values or it can read a new value from the data  source. The number of values of an Attribute that a Server has
 *    depends on the  number of MonitoredItems that are defined for the Attribute. In any case, the Client can make no
 *    assumption about which copy of the data will be returned.
 *    If the Server does not have a value that is within the maximum age, it shall attempt to read a new value from the
 *    data source.
 *    If the Server cannot meet the requested maxAge, it returns its 'best effort' value rather than rejecting the
 *    request.
 *    This may occur when the time it takes the Server to process and return the new data value after it has been
 *    accessed is greater than the specified maximum age.
 *    If maxAge is set to 0, the Server shall attempt to read a new value from the data source.
 *    If maxAge is set to the max Int32 value or greater, the Server shall attempt to geta cached value. Negative values
 *    are invalid for maxAge.
 *
 *  @return {DataValue[]}
 */
ServerEngine.prototype.read = function (context, readRequest) {

    assert(context instanceof SessionContext);
    assert(readRequest instanceof ReadRequest);
    assert(readRequest.maxAge >= 0);

    const engine = this;
    const timestampsToReturn = readRequest.timestampsToReturn;

    const nodesToRead = readRequest.nodesToRead;

    assert(engine.addressSpace instanceof AddressSpace); // initialize not called
    assert(_.isArray(nodesToRead));

    context.currentTime = new Date();

    const dataValues = [];
    for (let i = 0; i < nodesToRead.length; i++) {
        const readValueId = nodesToRead[i];
        dataValues[i] = engine._readSingleNode(context, readValueId, timestampsToReturn);
    }
    return dataValues;
};

/**
 *
 * @method writeSingleNode
 * @param context  {Context}
 * @param writeValue {DataValue}
 * @param callback {Function}
 * @param callback.err {Error|null}
 * @param callback.statusCode {StatusCode}
 * @async
 */
ServerEngine.prototype.writeSingleNode = function (context, writeValue, callback) {

    const engine = this;
    assert(context instanceof SessionContext);
    assert(_.isFunction(callback));
    assert(writeValue._schema.name === "WriteValue");
    assert(writeValue.value instanceof DataValue);

    if (writeValue.value.value === null) {
        return callback(null, StatusCodes.BadTypeMismatch);
    }

    assert(writeValue.value.value instanceof Variant);
    assert(engine.addressSpace instanceof AddressSpace); // initialize not called

    const nodeId = writeValue.nodeId;

    const obj = engine.__findObject(nodeId);
    if (!obj) {
        return callback(null, StatusCodes.BadNodeIdUnknown);
    } else {
        obj.writeAttribute(context, writeValue, callback);
    }
};


const WriteValue = require("node-opcua-service-write").WriteValue;

/**
 * write a collection of nodes
 * @method write
 * @param context {Object}
 * @param nodesToWrite {Object[]}
 * @param callback {Function}
 * @param callback.err
 * @param callback.results {StatusCode[]}
 * @async
 */
ServerEngine.prototype.write = function (context, nodesToWrite, callback) {

    assert(context instanceof SessionContext);
    assert(_.isFunction(callback));

    const engine = this;

    assert(engine.addressSpace instanceof AddressSpace); // initialize not called

    context.currentTime = new Date();

    function performWrite(writeValue, inner_callback) {
        assert(writeValue instanceof WriteValue);
        engine.writeSingleNode(context, writeValue, inner_callback);
    }

    async.map(nodesToWrite, performWrite, function (err, statusCodes) {

        assert(_.isArray(statusCodes));
        callback(err, statusCodes);

    });

};

/**
 *
 * @method historyReadSingleNode
 * @param context {SessionContext}
 * @param nodeId  {NodeId}
 * @param attributeId {AttributeId}
 * @param historyReadDetails {HistoryReadDetails}
 * @param [timestampsToReturn=TimestampsToReturn.Neither]
 * @param callback {Function}
 * @param callback.err
 * @param callback.results {HistoryReadResult}
 */
ServerEngine.prototype.historyReadSingleNode = function (context, nodeId, attributeId, historyReadDetails, timestampsToReturn, callback) {
    const engine = this;

    assert(context instanceof SessionContext);
    engine._historyReadSingleNode(context,
        {
            nodeId: nodeId,
            attributeId: attributeId
        }, historyReadDetails, timestampsToReturn, callback);
};

ServerEngine.prototype._historyReadSingleNode = function (context, nodeToRead, historyReadDetails, timestampsToReturn, callback) {

    assert(context instanceof SessionContext);
    assert(callback instanceof Function);

    const engine = this;
    const nodeId = nodeToRead.nodeId;
    const indexRange = nodeToRead.indexRange;
    const dataEncoding = nodeToRead.dataEncoding;
    const continuationPoint = nodeToRead.continuationPoint;
    assert(engine.addressSpace instanceof AddressSpace); // initialize not called

    if (timestampsToReturn === TimestampsToReturn.Invalid) {
        return new DataValue({statusCode: StatusCodes.BadTimestampsToReturnInvalid});
    }

    timestampsToReturn = (_.isObject(timestampsToReturn)) ? timestampsToReturn : TimestampsToReturn.Neither;

    const obj = engine.__findObject(nodeId);

    if (!obj) {
        // may be return BadNodeIdUnknown in dataValue instead ?
        // Object Not Found
        callback(null, new HistoryReadResult({statusCode: StatusCodes.BadNodeIdUnknown}));
    } else {

        if (!obj.historyRead) {
            // note : Object and View may also support historyRead to provide Event historical data
            //        todo implement historyRead for Object and View
            const msg = " this node doesn't provide historyRead! probably not a UAVariable\n "
                + obj.nodeId.toString() + " " + obj.browseName.toString() + "\n"
                + "with " + nodeToRead.toString() + "\n"
                + "HistoryReadDetails " + historyReadDetails.toString();
            if (doDebug) {
                console.log("ServerEngine#_historyReadSingleNode ".cyan, msg.white.bold);
            }
            const err = new Error(msg);
            // object has no historyRead method
            return setImmediate(callback.bind(null, err));
        }
        // check access
        //    BadUserAccessDenied
        //    BadNotReadable
        //    invalid attributes : BadNodeAttributesInvalid
        //    invalid range      : BadIndexRangeInvalid
        obj.historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, function (err, result) {
            assert(result.statusCode instanceof StatusCode);
            assert(result.isValid());
            //result = apply_timestamps(result, timestampsToReturn, attributeId);
            callback(err, result);
        });
    }
};

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
 *  @param callback {Function}
 *  @param callback.err
 *  @param callback.results {HistoryReadResult[]}
 */
ServerEngine.prototype.historyRead = function (context, historyReadRequest, callback) {

    assert(context instanceof SessionContext);
    assert(historyReadRequest instanceof HistoryReadRequest);
    assert(_.isFunction(callback));

    const engine = this;
    const timestampsToReturn = historyReadRequest.timestampsToReturn;
    const historyReadDetails = historyReadRequest.historyReadDetails;

    const nodesToRead = historyReadRequest.nodesToRead;

    assert(historyReadDetails instanceof HistoryReadDetails);
    assert(engine.addressSpace instanceof AddressSpace); // initialize not called
    assert(_.isArray(nodesToRead));

    const historyData = [];
    async.eachSeries(nodesToRead, function (readValueId, cbNode) {
        engine._historyReadSingleNode(context, readValueId, historyReadDetails, timestampsToReturn, function (err, result) {

            if (err && !result) {
                result = new HistoryReadResult({statusCode: StatusCodes.BadInternalError});
            }
            historyData.push(result);
            async.setImmediate(cbNode); //it's not guaranteed that the historical read process is really asynchronous
        });
    }, function (err) {
        assert(historyData.length === nodesToRead.length);
        callback(err, historyData);
    });
};

function __bindVariable(self, nodeId, options) {
    options = options || {};
    // must have a get and a set property
    assert(_.difference(["get", "set"], _.keys(options)).length === 0);

    const obj = self.addressSpace.findNode(nodeId);
    if (obj && obj.bindVariable) {
        obj.bindVariable(options);
        assert(_.isFunction(obj.asyncRefresh));
        assert(_.isFunction(obj.refreshFunc));
    } else {
        //xx console.log((new Error()).stack);
        console.log("Warning: cannot bind object with id ", nodeId.toString(), " please check your nodeset.xml file or add this node programmatically");
    }
}


/**
 * @method bindMethod
 * @param nodeId {NodeId} the node id of the method
 * @param func
 * @param func.inputArguments               {Array<Variant>}
 * @param func.context                      {Object}
 * @param func.callback                     {Function}
 * @param func.callback.err                 {Error}
 * @param func.callback.callMethodResult    {CallMethodResult}
 */
ServerEngine.prototype.__internal_bindMethod = function (nodeId, func) {

    const engine = this;
    assert(_.isFunction(func));
    assert(nodeId instanceof NodeId);

    const methodNode = engine.addressSpace.findNode(nodeId);
    if (!methodNode) {
        return;
    }
    if (methodNode && methodNode.bindMethod) {
        methodNode.bindMethod(func);
    } else {
        //xx console.log((new Error()).stack);
        console.log("WARNING:  cannot bind a method with id ".yellow + nodeId.toString().cyan + ". please check your nodeset.xml file or add this node programmatically".yellow);
        console.log(require("node-opcua-debug").trace_from_this_projet_only(new Error()))
    }
};

ServerEngine.prototype.getOldestUnactivatedSession = function () {

    const engine = this;
    const tmp = _.filter(engine._sessions, function (session) {
        return session.status === "new";
    });
    if (tmp.length === 0) {
        return null;
    }
    let session = tmp[0];
    for (let i = 1; i < session.length; i++) {
        const c = tmp[i];
        if (session.creationDate.getTime() < c.creationDate.getTime()) {
            session = c;
        }
    }
    return session;
};


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

const Subscription = require("./server_subscription").Subscription;

ServerEngine.prototype._getServerSubscriptionDiagnosticsArray = function () {

    const engine = this;
    if (!engine.addressSpace) {
        if (doDebug) {
            console.warn("ServerEngine#_getServerSubscriptionDiagnosticsArray : no addressSpace");
        }
        return null; // no addressSpace
    }
    const subscriptionDiagnosticsType = engine.addressSpace.findVariableType("SubscriptionDiagnosticsType");
    if (!subscriptionDiagnosticsType) {
        if (doDebug) {
            console.warn("ServerEngine#_getServerSubscriptionDiagnosticsArray : cannot find SubscriptionDiagnosticsType");
        }
    }

    // SubscriptionDiagnosticsArray = i=2290
    const subscriptionDiagnosticsArray = engine.addressSpace.findNode(makeNodeId(VariableIds.Server_ServerDiagnostics_SubscriptionDiagnosticsArray));

    return subscriptionDiagnosticsArray;
};
const SubscriptionDiagnostics = require("node-opcua-common").SubscriptionDiagnostics;

ServerEngine.prototype._exposeSubscriptionDiagnostics = function (subscription) {

    debugLog("ServerEngine#_exposeSubscriptionDiagnostics");
    const engine = this;
    const subscriptionDiagnosticsArray = engine._getServerSubscriptionDiagnosticsArray();
    const subscriptionDiagnostics = subscription.subscriptionDiagnostics;
    assert(subscriptionDiagnostics.$subscription == subscription);

    if (subscriptionDiagnostics && subscriptionDiagnosticsArray) {
        //xx console.log("GGGGGGGGGGGGGGGG ServerEngine => Exposing subscription diagnostics =>",subscription.id);
        eoan.addElement(subscriptionDiagnostics, subscriptionDiagnosticsArray);
    }
};
ServerEngine.prototype._unexposeSubscriptionDiagnostics = function (subscription) {

    const engine = this;
    const subscriptionDiagnosticsArray = engine._getServerSubscriptionDiagnosticsArray();
    const subscriptionDiagnostics = subscription.subscriptionDiagnostics;
    assert(subscriptionDiagnostics instanceof SubscriptionDiagnostics);
    if (subscriptionDiagnostics && subscriptionDiagnosticsArray) {

        const node = subscriptionDiagnosticsArray[subscription.id];
        /// console.log("GGGGGGGGGGGGGGGG ServerEngine => **Unexposing** subscription diagnostics =>",subscription.id);
        eoan.removeElement(subscriptionDiagnosticsArray, subscriptionDiagnostics);
        assert(!subscriptionDiagnosticsArray[subscription.id]," subscription node must have been removed from subscriptionDiagnosticsArray");
    }
    debugLog("ServerEngine#_unexposeSubscriptionDiagnostics");
};
/**
 * create a new subscription
 * @method _createSubscriptionOnSession
 * @param request
 * @param request.requestedPublishingInterval {Duration}
 * @param request.requestedLifetimeCount {Counter}
 * @param request.requestedMaxKeepAliveCount {Counter}
 * @param request.maxNotificationsPerPublish {Counter}
 * @param request.publishingEnabled {Boolean}
 * @param request.priority {Byte}
 * @return {Subscription}
 */
ServerEngine.prototype._createSubscriptionOnSession = function (session,request) {

    const engine = this;

    assert(request.hasOwnProperty("requestedPublishingInterval")); // Duration
    assert(request.hasOwnProperty("requestedLifetimeCount"));      // Counter
    assert(request.hasOwnProperty("requestedMaxKeepAliveCount"));  // Counter
    assert(request.hasOwnProperty("maxNotificationsPerPublish"));  // Counter
    assert(request.hasOwnProperty("publishingEnabled"));           // Boolean
    assert(request.hasOwnProperty("priority"));                    // Byte

    const subscription = new Subscription({
        publishingInterval: request.requestedPublishingInterval,
        lifeTimeCount: request.requestedLifetimeCount,
        maxKeepAliveCount: request.requestedMaxKeepAliveCount,
        maxNotificationsPerPublish: request.maxNotificationsPerPublish,
        publishingEnabled: request.publishingEnabled,
        priority: request.priority,
        id: _get_next_subscriptionId(),
        // -------------------
        publishEngine: session.publishEngine, //
        sessionId: NodeId.NullNodeId
    });

    // add subscriptionDiagnostics
    engine._exposeSubscriptionDiagnostics(subscription);

    assert(subscription.publishEngine === session.publishEngine);
    session.publishEngine.add_subscription(subscription);

    subscription.once("terminated",function() {
        const subscription = this;
        engine._unexposeSubscriptionDiagnostics(subscription);
    });

    return subscription;
};

/**
 * create a new server session object.
 * @class ServerEngine
 * @method createSession
 * @param  [options] {Object}
 * @param  [options.sessionTimeout = 1000] {Number} sessionTimeout
 * @param  [options.clientDescription] {ApplicationDescription}
 * @return {ServerSession}
 */
ServerEngine.prototype.createSession = function (options) {

    options = options || {};

    const engine = this;

    engine.serverDiagnosticsSummary.cumulatedSessionCount += 1;
    engine.serverDiagnosticsSummary.currentSessionCount += 1;

    engine.clientDescription = options.clientDescription || new ApplicationDescription({});

    const sessionTimeout = options.sessionTimeout || 1000;

    assert(_.isNumber(sessionTimeout));

    const session = new ServerSession(engine, engine.cumulatedSessionCount, sessionTimeout);

    const key = session.authenticationToken.toString();

    engine._sessions[key] = session;

    // see spec OPC Unified Architecture,  Part 2 page 26 Release 1.02
    // TODO : When a Session is created, the Server adds an entry for the Client
    //        in its SessionDiagnosticsArray Variable

    session.on("new_subscription", function (subscription) {
        engine.serverDiagnosticsSummary.cumulatedSubscriptionCount += 1;
        // add the subscription diagnostics in our subscriptions diagnostics array
    });

    session.on("subscription_terminated", function (subscription) {
        // remove the subscription diagnostics in our subscriptions diagnostics array
    });

    // OPC Unified Architecture, Part 4 23 Release 1.03
    // Sessions are terminated by the Server automatically if the Client fails to issue a Service request on the Session
    // within the timeout period negotiated by the Server in the CreateSession Service response. This protects the
    // Server against Client failures and against situations where a failed underlying connection cannot be
    // re-established. Clients shall be prepared to submit requests in a timely manner to prevent the Session from
    // closing automatically. Clients may explicitly terminate sessions using the CloseSession Service.
    session.on("timeout", function () {
        // the session hasn't been active for a while , probably because the client has disconnected abruptly
        // it is now time to close the session completely
        engine.serverDiagnosticsSummary.sessionTimeoutCount += 1;
        session.sessionName = session.sessionName || "";

        console.log("Server: closing SESSION ".cyan, session.status, session.sessionName.yellow, " because of timeout = ".cyan, session.sessionTimeout, " has expired without a keep alive".cyan);
        const channel = session.channel;
        if (channel) {
            console.log("channel = ".bgCyan, channel.remoteAddress, " port = ", channel.remotePort);
        }

        // If a Server terminates a Session for any other reason, Subscriptions  associated with the Session,
        // are not deleted. => deleteSubscription= false
        engine.closeSession(session.authenticationToken, /*deleteSubscription=*/false, /* reason =*/"Timeout");
    });

    return session;
};


/**
 * the ServerSidePublishEngineForOrphanSubscription is keeping track of
 * live subscription that have been detached from timed out session.
 * It takes care of providing back those subscription to any session that
 * will claim them again with transferSubscription  service
 * It also make sure that subscription are properly disposed when  they expire.
 *
 * @constructor
 */
function ServerSidePublishEngineForOrphanSubscription() {
    ServerSidePublishEngine.apply(this, arguments);
}

util.inherits(ServerSidePublishEngineForOrphanSubscription, ServerSidePublishEngine);

ServerSidePublishEngineForOrphanSubscription.prototype.add_subscription = function (subscription) {
    debugLog(" adding live subscription with id=".bgCyan.yellow.bold, subscription.id, " to orphan");
    const publish_engine = this;
    ServerSidePublishEngine.prototype.add_subscription.apply(this, arguments);
    // also add an event handler to detected when the subscription has ended
    // so we can automatically remove it from the orphan table
    subscription._expired_func = function () {
        const subscription = this;
        debugLog(" Removing expired subscription with id=".bgCyan.yellow, subscription.id, " from orphan");
        // make sure all monitored item have been deleted
        //Xx subscription.terminate();
        //xx publish_engine.detach_subscription(subscription);
        //Xx subscription.dispose();
    };
    subscription.on("expired", subscription._expired_func);
};

ServerSidePublishEngineForOrphanSubscription.prototype.detach_subscription = function (subscription) {
    // un set the event handler
    ServerSidePublishEngine.prototype.detach_subscription.apply(this, arguments);
    subscription.removeListener("expired", subscription._expired_func);
    subscription._expired_func = null;
    return subscription;
};


/**
 * @method closeSession
 * @param authenticationToken
 * @param deleteSubscriptions {Boolean} : true if sessions's subscription shall be deleted
 * @param {String} [reason = "CloseSession"] the reason for closing the session (shall be "Timeout", "Terminated" or "CloseSession")
 *
 *
 * what the specs say:
 * -------------------
 *
 * If a Client invokes the CloseSession Service then all Subscriptions associated with the Session are also deleted
 * if the deleteSubscriptions flag is set to TRUE. If a Server terminates a Session for any other reason, Subscriptions
 * associated with the Session, are not deleted. Each Subscription has its own lifetime to protect against data loss
 * in the case of a Session termination. In these cases, the Subscription can be reassigned to another Client before
 * its lifetime expires.
 */
ServerEngine.prototype.closeSession = function (authenticationToken, deleteSubscriptions, reason) {

    const engine = this;

    reason = reason || "CloseSession";
    assert(_.isString(reason));
    assert(reason === "Timeout" || reason === "Terminated" || reason === "CloseSession" || reason === "Forcing");

    debugLog("ServerEngine.closeSession ", authenticationToken.toString(), deleteSubscriptions);

    const key = authenticationToken.toString();
    const session = engine.getSession(key);
    assert(session);

    if (!deleteSubscriptions) {

        // Live Subscriptions will not be deleted, but transferred to the orphanPublishEngine
        // until they time out or until a other session transfer them back to it.
        if (!engine._orphanPublishEngine) {
            engine._orphanPublishEngine = new ServerSidePublishEngineForOrphanSubscription({maxPublishRequestInQueue: 0});

        }

        debugLog("transferring remaining live subscription to orphanPublishEngine !");
        ServerSidePublishEngine.transferSubscriptionsToOrphan(session.publishEngine, engine._orphanPublishEngine);
    }

    session.close(deleteSubscriptions, reason);

    assert(session.status === "closed");

    engine.serverDiagnosticsSummary.currentSessionCount -= 1;

    //xx //TODO make sure _closedSessions gets cleaned at some point
    //xx self._closedSessions[key] = session;

    // remove sessionDiagnostics from server.ServerDiagnostics.SessionsDiagnosticsSummary.SessionDiagnosticsSummary
    delete engine._sessions[key];
    session.dispose();

};

ServerEngine.prototype.findSubscription = function (subscriptionId) {

    const engine = this;

    const subscriptions = [];
    _.map(engine._sessions, function (session) {
        if (subscriptions.length) return;
        const subscription = session.publishEngine.getSubscriptionById(subscriptionId);
        if (subscription) {
            //xx console.log("foundSubscription  ", subscriptionId, " in session", session.sessionName);
            subscriptions.push(subscription)
        }
    });
    if (subscriptions.length) {
        assert(subscriptions.length === 1);
        return subscriptions[0];
    }
    return engine.findOrphanSubscription(subscriptionId);
};

ServerEngine.prototype.findOrphanSubscription = function (subscriptionId) {

    const engine = this;

    if (!engine._orphanPublishEngine) {
        return null;
    }
    return engine._orphanPublishEngine.getSubscriptionById(subscriptionId);
};

ServerEngine.prototype.deleteOrphanSubscription = function (subscription) {
    const engine = this;
    assert(engine.findSubscription(subscription.id));

    const c = engine._orphanPublishEngine.subscriptionCount;
    subscription.terminate();
    subscription.dispose();
    assert(engine._orphanPublishEngine.subscriptionCount === c - 1);
    return StatusCodes.Good;
};

const TransferResult = require("node-opcua-service-subscription").TransferResult;

/**
 * @method transferSubscription
 * @param session           {ServerSession}  - the new session that will own the subscription
 * @param subscriptionId    {IntegerId}      - the subscription Id to transfer
 * @param sendInitialValues {Boolean}        - true if initial values will be resent.
 * @return                  {TransferResult}
 */
ServerEngine.prototype.transferSubscription = function (session, subscriptionId, sendInitialValues){

    const engine = this;
    assert(session instanceof ServerSession);
    assert(_.isNumber(subscriptionId));
    assert(_.isBoolean(sendInitialValues));

    if (subscriptionId <= 0) {
        return new TransferResult({statusCode: StatusCodes.BadSubscriptionIdInvalid});
    }

    const subscription = engine.findSubscription(subscriptionId);
    if (!subscription) {
        return new TransferResult({statusCode: StatusCodes.BadSubscriptionIdInvalid});
    }
    // // now check that new session has sufficient right
    // if (session.authenticationToken.toString() !== subscription.authenticationToken.toString()) {
    //     console.log("ServerEngine#transferSubscription => BadUserAccessDenied");
    //     return new TransferResult({ statusCode: StatusCodes.BadUserAccessDenied });
    // }
    if (session.publishEngine === subscription.publishEngine) {
        // subscription is already in this session !!
        return new TransferResult({statusCode: StatusCodes.BadNothingToDo});
    }
    if (session === subscription.$session) {
        // subscription is already in this session !!
        return new TransferResult({statusCode: StatusCodes.BadNothingToDo});
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
        statusCode: StatusCodes.Good,
        availableSequenceNumbers: subscription.getAvailableSequenceNumbers()
    });

    // istanbul ignore next
    if (doDebug) {
        debugLog("TransferResult", result.toString());
    }

    return result;

};

/**
 * retrieve a session by its authenticationToken.
 *
 * @method getSession
 * @param authenticationToken
 * @param activeOnly
 * @return {ServerSession}
 */
ServerEngine.prototype.getSession = function (authenticationToken, activeOnly) {

    const engine = this;
    if (!authenticationToken || (authenticationToken.identifierType && (authenticationToken.identifierType.value !== NodeIdType.BYTESTRING.value))) {
        return null;     // wrong type !
    }
    const key = authenticationToken.toString();
    let session = engine._sessions[key];
    if (!activeOnly && !session) {
        session = engine._closedSessions[key];
    }
    return session;
};


/**
 * @method browsePath
 * @param browsePath
 * @return {BrowsePathResult}
 */
ServerEngine.prototype.browsePath = function (browsePath) {
    const engine = this;
    return engine.addressSpace.browsePath(browsePath);
};


/**
 *
 * performs a call to ```asyncRefresh``` on all variable nodes that provide an async refresh func.
 *
 * @method refreshValues
 * @param nodesToRefresh {Array<Object>}  an array containing the node to consider
 * Each element of the array shall be of the form { nodeId: <xxx>, attributeIds: <value> }.
 *
 * @param callback {Function}
 * @param callback.err {null|Error}
 * @param callback.data {Array} : an array containing value read
 * The array length matches the number of  nodeIds that are candidate for an async refresh (i.e: nodes that are of type
 * Variable with asyncRefresh func }
 *
 * @async
 */
ServerEngine.prototype.refreshValues = function (nodesToRefresh, callback) {

    assert(callback instanceof Function);
    const engine = this;

    const objs = {};
    for (let i = 0; i < nodesToRefresh.length; i++) {
        const nodeToRefresh = nodesToRefresh[i];
        // only consider node  for which the caller wants to read the Value attribute
        // assuming that Value is requested if attributeId is missing,
        if (nodeToRefresh.attributeId && nodeToRefresh.attributeId !== AttributeIds.Value) {
            continue;
        }
        // ... and that are valid object and instances of Variables ...
        const obj = engine.addressSpace.findNode(nodeToRefresh.nodeId);
        if (!obj || !(obj instanceof UAVariable)) {
            continue;
        }
        // ... and that have been declared as asynchronously updating
        if (!_.isFunction(obj.refreshFunc)) {
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
    async.map(objs, function (obj, inner_callback) {
        obj.asyncRefresh(inner_callback);
    }, function (err, arrResult) {
        callback(err, arrResult);
    });

};

exports.ServerEngine = ServerEngine;

