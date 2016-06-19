"use strict";
/**
 * @module opcua.server
 */

require("requirish")._(module);
var assert = require("better-assert");
var async = require("async");

var NodeClass = require("lib/datamodel/nodeclass").NodeClass;

var NodeId = require("lib/datamodel/nodeid").NodeId;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
var NodeIdType = require("lib/datamodel/nodeid").NodeIdType;
var NumericRange = require("lib/datamodel/numeric_range").NumericRange;
var browse_service = require("lib/services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;
var BrowseResult = browse_service.BrowseResult;


var read_service = require("lib/services/read_service");
var ReadRequest = read_service.ReadRequest;
var AttributeIds = read_service.AttributeIds;
var TimestampsToReturn = read_service.TimestampsToReturn;

var BaseNode = require("lib/address_space/base_node").BaseNode;
var UAObject = require("lib/address_space/ua_object").UAObject;
var UAVariable = require("lib/address_space/ua_variable").UAVariable;

var historizing_service = require("lib/services/historizing_service");
var HistoryReadRequest = historizing_service.HistoryReadRequest;
var HistoryReadDetails = historizing_service.HistoryReadDetails;
var HistoryReadResult = historizing_service.HistoryReadResult;

var DataValue = require("lib/datamodel/datavalue").DataValue;
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var isValidVariant = require("lib/datamodel/variant").isValidVariant;
var LocalizedText = require("lib/datamodel/localized_text").LocalizedText;
var BuildInfo = require("lib/datamodel/buildinfo").BuildInfo;

var util = require("util");


var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var StatusCode = require("lib/datamodel/opcua_status_code").StatusCode;

var _ = require("underscore");

var address_space = require("lib/address_space/address_space");
var AddressSpace = address_space.AddressSpace;

var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;

var ServerSession = require("lib/server/server_session").ServerSession;

var VariableIds = require("lib/opcua_node_ids").VariableIds;
var MethodIds = require("lib/opcua_node_ids").MethodIds;
var ObjectIds = require("lib/opcua_node_ids").ObjectIds;

var ReferenceType = require("lib/address_space/referenceType").ReferenceType;


var EventEmitter = require("events").EventEmitter;

//xx require("lib/address_space/convert_nodeset_to_types").makeServerStatus();
var ServerState = require("schemas/39394884f696ff0bf66bacc9a8032cc074e0158e/ServerState_enum").ServerState;
var ServerStatus = require("_generated_/_auto_generated_ServerStatus").ServerStatus;

var ServerDiagnosticsSummary = require("_generated_/_auto_generated_ServerDiagnosticsSummary").ServerDiagnosticsSummary;

var constructFilename = require("lib/misc/utils").constructFilename;

var endpoints_service = require("lib/services/get_endpoints_service");
var ApplicationDescription = endpoints_service.ApplicationDescription;

var standard_nodeset_file = constructFilename("nodesets/Opc.Ua.NodeSet2.xml");
exports.standard_nodeset_file = standard_nodeset_file;

var mini_nodeset_filename = constructFilename("lib/server/mini.Node.Set2.xml");
exports.mini_nodeset_filename = mini_nodeset_filename;

var part8_nodeset_filename = constructFilename("nodesets/Opc.Ua.NodeSet2.Part8.xml");
exports.part8_nodeset_filename = part8_nodeset_filename;

var di_nodeset_filename = constructFilename("nodesets/Opc.Ua.Di.NodeSet2.xml");
exports.di_nodeset_filename = di_nodeset_filename;

var adi_nodeset_filename = constructFilename("nodesets/Opc.Ua.Adi.NodeSet2.xml");
exports.adi_nodeset_filename = adi_nodeset_filename;

var debugLog = require("lib/misc/utils").make_debugLog(__filename);
//var doDebug = require("lib/misc/utils").checkDebugFlag(__filename);

var ServerCapabilities = require("./server_capabilities").ServerCapabilities;

var eoan = require("lib/address_space/extension_object_array_node");

/**
 * @class ServerEngine
 * @extends EventEmitter
 * @uses ServerSidePublishEngine
 * @params options
 * @param options.buildInfo
 * @param [options.isAuditing = false ] {Boolean}
 * @param [options.serverCapabilities]
 * @param [options.serverCapabilities.serverProfileArray]
 * @param [options.serverCapabilities.localeIdArray]
 * @param options.applicationUri {String} the application URI.
 * @constructor
 */
function ServerEngine(options) {

    options = options || {};
    options.buildInfo = options.buildInfo || {};

    EventEmitter.apply(this, arguments);

    this._sessions = {};
    this._closedSessions = {};

    this.isAuditing = _.isBoolean(options.isAuditing) ? options.isAuditing : false;

    // ---------------------------------------------------- ServerStatus
    this.serverStatus = new ServerStatus({
        startTime: new Date(),
        currentTime: new Date(),
        state: ServerState.NoConfiguration,
        buildInfo: options.buildInfo,
        secondsTillShutdown: 10,
        shutdownReason: {text: ""}
    });

    var self = this;

    this.serverStatus.__defineGetter__("secondsTillShutdown",function() {
        return self.secondsTillShutdown();
    });

    this.serverStatus.__defineGetter__("currentTime",function() {
       return new Date();
    });
    this.serverStatus.__defineSetter__("currentTime",function(value) {
        // DO NOTHING currentTime is readonly
    });

    // --------------------------------------------------- ServerCapabilities
    options.serverCapabilities = options.serverCapabilities ||{};
    options.serverCapabilities.serverProfileArray = options.serverCapabilities.serverProfileArray || [];
    options.serverCapabilities.localeIdArray = options.serverCapabilities.localeIdArray ||["en-EN", "fr-FR"];

    this.serverCapabilities = new ServerCapabilities(options.serverCapabilities);

    // --------------------------------------------------- serverDiagnosticsSummary
    this.serverDiagnosticsSummary = new ServerDiagnosticsSummary({

    });
    assert(this.serverDiagnosticsSummary.hasOwnProperty("currentSessionCount"));

    var self = this;
    this.serverDiagnosticsSummary.__defineGetter__("currentSessionCount", function () {
        return Object.keys(self._sessions).length;
    });
    assert(this.serverDiagnosticsSummary.hasOwnProperty("currentSubscriptionCount"));
    this.serverDiagnosticsSummary.__defineGetter__("currentSubscriptionCount", function () {
        // currentSubscriptionCount returns the total number of subscriptions
        // that are currently active on all sessions
        var counter = 0;
        _.values(self._sessions).forEach(function (session) {
            counter += session.currentSubscriptionCount;
        });
        return counter;
    });

    this.status = "creating";

    this.setServerState(ServerState.NoConfiguration);

    this.addressSpace = null;

    this._shutdownTask = [];

    this._applicationUri = options.applicationUri || "<unset _applicationUri>";
}

util.inherits(ServerEngine, EventEmitter);

ServerEngine.prototype.__defineGetter__("startTime",function() {
    return this.serverStatus.startTime;
});

ServerEngine.prototype.__defineGetter__("currentTime",function() {
    return this.serverStatus.currentTime;
});

ServerEngine.prototype.__defineGetter__("buildInfo",function() {
    return this.serverStatus.buildInfo;
});
/**
 * register a function that will be called when the server will perform its shut down.
 * @method registerShutdownTask
 */
ServerEngine.prototype.registerShutdownTask = function (task) {
    assert(_.isFunction(task));
    this._shutdownTask.push(task);

};

function disposeAddressSpace() {

    if (this.addressSpace) {
        this.addressSpace.dispose();
        delete this.addressSpace;
    }
    this._shutdownTask = [];
}
/**
 * @method shutdown
 */
ServerEngine.prototype.shutdown = function () {

    var self = this;

    self.status = "shutdown";
    self.setServerState(ServerState.Shutdown);

    // delete any existing sessions
    var tokens = Object.keys(self._sessions).map(function (key) {
        var session = self._sessions[key];
        return session.authenticationToken;
    });

    //xx console.log("xxxxxxxxx ServerEngine.shutdown must terminate "+ tokens.length," sessions");

    tokens.forEach(function (token) {
        self.closeSession(token, true, "Terminated");
    });

    // all sessions must have been terminated
    assert(self.currentSessionCount === 0);

    self._shutdownTask.push(disposeAddressSpace);

    // perform registerShutdownTask
    self._shutdownTask.forEach(function (task) {
        task.call(self);
    });
};

/**
 * the number of active sessions
 * @property currentSessionCount
 * @type {Number}
 */
ServerEngine.prototype.__defineGetter__("currentSessionCount", function () {
    return this.serverDiagnosticsSummary.currentSessionCount;
});

/**
 * the cumulated number of sessions that have been opened since this object exists
 * @property cumulatedSessionCount
 * @type {Number}
 */
ServerEngine.prototype.__defineGetter__("cumulatedSessionCount", function () {
    return this.serverDiagnosticsSummary.cumulatedSessionCount;
});

/**
 * the number of active subscriptions.
 * @property currentSubscriptionCount
 * @type {Number}
 */
ServerEngine.prototype.__defineGetter__("currentSubscriptionCount", function () {
    return this.serverDiagnosticsSummary.currentSubscriptionCount;
});
/**
 * the cumulated number of subscriptions that have been created since this object exists
 * @property cumulatedSubscriptionCount
 * @type {Number}
 */
ServerEngine.prototype.__defineGetter__("cumulatedSubscriptionCount", function () {
    return this.serverDiagnosticsSummary.cumulatedSubscriptionCount;
});

ServerEngine.prototype.__defineGetter__("rejectedSessionCount", function () {
    return this.serverDiagnosticsSummary.rejectedSessionCount;
});

ServerEngine.prototype.__defineGetter__("rejectedRequestsCount", function () {
    return this.serverDiagnosticsSummary.rejectedRequestsCount;
});

ServerEngine.prototype.__defineGetter__("sessionAbortCount", function () {
    return this.serverDiagnosticsSummary.sessionAbortCount;
});
ServerEngine.prototype.__defineGetter__("sessionTimeoutCount", function () {
    return this.serverDiagnosticsSummary.sessionTimeoutCount;
});

ServerEngine.prototype.__defineGetter__("publishingIntervalCount", function () {
    return this.serverDiagnosticsSummary.publishingIntervalCount;
});


/**
 * @method secondsTillShutdown
 * @return {UInt32} the approximate number of seconds until the server will be shut down. The
 * value is only relevant once the state changes into SHUTDOWN.
 */
ServerEngine.prototype.secondsTillShutdown = function () {
    // ToDo: implement a correct solution here
    return 1;
};


var CallMethodResult = require("lib/services/call_service").CallMethodResult;
// binding methods
function getMonitoredItemsId(inputArguments, context, callback) {


    assert(_.isArray(inputArguments));
    assert(_.isFunction(callback));

    assert(context.hasOwnProperty("session"), " expecting a session id in the context object");

    var session = context.session;
    if (!session) {
        return callback(null, {statusCode: StatusCodes.BadInternalError});
    }

    var subscriptionId = inputArguments[0].value;
    var subscription = session.getSubscription(subscriptionId);
    if (!subscription) {
        return callback(null, {statusCode: StatusCodes.BadSubscriptionIdInvalid});
    }
    var result = subscription.getMonitoredItems();
    assert(result.statusCode);
    assert(_.isArray(result.serverHandles));
    assert(_.isArray(result.clientHandles));
    assert(result.serverHandles.length === result.clientHandles.length);
    var callMethodResult = new CallMethodResult({
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
    return this.serverStatus.buildInfo.productName;
});

/**
 * the server urn
 * @property serverNameUrn
 * @type String
 */
ServerEngine.prototype.__defineGetter__("serverNameUrn", function () {
    return this._applicationUri;
});

/**
 * the urn of the server namespace
 * @property serverNamespaceName
 * @type String
 */
ServerEngine.prototype.__defineGetter__("serverNamespaceUrn", function () {
    return this._applicationUri; // "urn:" + this.serverName;
});


ServerEngine.prototype.setServerState = function (serverState) {
    assert(serverState !== null && serverState !== undefined);
    this.serverStatus.state = serverState;
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

    var self = this;
    assert(!self.addressSpace); // check that 'initialize' has not been already called

    self.status = "initializing";

    options = options || {};
    assert(_.isFunction(callback));

    options.nodeset_filename = options.nodeset_filename || standard_nodeset_file;

    var startTime = new Date();

    debugLog("Loading ", options.nodeset_filename, "...");

    self.addressSpace = new AddressSpace();

    // register namespace 1 (our namespace);
    var serverNamespaceIndex = self.addressSpace.registerNamespace(self.serverNamespaceUrn);
    assert(serverNamespaceIndex === 1);

    generate_address_space(self.addressSpace, options.nodeset_filename, function () {

        var endTime = new Date();
        debugLog("Loading ", options.nodeset_filename, " done : ", endTime - startTime, " ms");

        function findObjectNodeId(name) {
            var obj = self.addressSpace.findNode(name);
            return obj ? obj.nodeId : null;
        }

        self.FolderTypeId = findObjectNodeId("FolderType");
        self.BaseObjectTypeId = findObjectNodeId("BaseObjectType");
        self.BaseDataVariableTypeId = findObjectNodeId("BaseDataVariableType");

        self.rootFolder = self.addressSpace.findNode("RootFolder");
        assert(self.rootFolder.readAttribute);

        self.setServerState(ServerState.Running);

        function bindVariableIfPresent(nodeId, opts) {
            assert(nodeId instanceof NodeId);
            assert(!nodeId.isEmpty());
            var obj = self.addressSpace.findNode(nodeId);
            if (obj) {
                __bindVariable(self, nodeId, opts);
            }
            return obj;
        }


        // -------------------------------------------- install default get/put handler
        var server_NamespaceArray_Id = makeNodeId(VariableIds.Server_NamespaceArray); // ns=0;i=2255
        bindVariableIfPresent(server_NamespaceArray_Id, {
            get: function () {
                return new Variant({
                    dataType: DataType.String,
                    arrayType: VariantArrayType.Array,
                    value: self.addressSpace.getNamespaceArray()
                });
            },
            set: null // read only
        });

        var server_NameUrn_var = new Variant({
            dataType: DataType.String,
            arrayType: VariantArrayType.Array,
            value: [
                self.serverNameUrn // this is us !
            ]
        });
        var server_ServerArray_Id = makeNodeId(VariableIds.Server_ServerArray); // ns=0;i=2254

        bindVariableIfPresent(server_ServerArray_Id, {
            get: function () {
                return server_NameUrn_var;
            },
            set: null // read only
        });


        function bindStandardScalar(id, dataType, func , setter_func) {

            assert(_.isNumber(id));
            assert(_.isFunction(func));
            assert(_.isFunction(setter_func) || !setter_func);
            assert(dataType !== null); // check invalid dataType

            var setter_func2 = null;
            if (setter_func) {
                setter_func2 = function(variant) {
                    var variable2 = !!variant.value;
                    setter_func(variable2);
                    return StatusCodes.Good;
                }
            }

            var nodeId = makeNodeId(id);

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

            var nodeId = makeNodeId(id);

            // make sur the provided function returns a valid value for the variant type
            // This test may not be exhaustive but it will detect obvious mistakes.
            assert(isValidVariant(VariantArrayType.Array, dataType, func()));

            bindVariableIfPresent(nodeId, {
                get: function () {
                    var value = func();
                    assert( _.isArray(value));
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
                return self.isAuditing;
            });


        function bindServerDiagnostics() {

            var serverDiagnostics_Enabled = false;

            bindStandardScalar(VariableIds.Server_ServerDiagnostics_EnabledFlag,
                DataType.Boolean,function() {
                    return serverDiagnostics_Enabled
                },function(newFlag) {
                    serverDiagnostics_Enabled = newFlag;
                });



            var serverDiagnosticsSummary_var = new Variant({
                dataType: DataType.ExtensionObject,
                value: self.serverDiagnosticsSummary
            });
            bindVariableIfPresent(makeNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary), {
                get: function() {
                    return serverDiagnosticsSummary_var;
                },
                set: null
            });

            var serverDiagnosticsSummary = self.addressSpace.findNode(makeNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary));
            if(serverDiagnosticsSummary) {
                serverDiagnosticsSummary.bindExtensionObject();
            }

        }

        function bindServerStatus() {


            var serverStatus_var = new Variant({
                dataType: DataType.ExtensionObject,
                value: self.serverStatus
            });


            bindVariableIfPresent(makeNodeId(VariableIds.Server_ServerStatus), {
                get: function() {
                    return serverStatus_var;
                },
                set: null
            });

            var serverStatus = self.addressSpace.findNode(makeNodeId(VariableIds.Server_ServerStatus));
            if(serverStatus) {
                serverStatus.bindExtensionObject();
                serverStatus.miminumSamplingInterval = 250;
            }

            var currentTimeNode = self.addressSpace.findNode(makeNodeId(VariableIds.Server_ServerStatus_CurrentTime));

            if (currentTimeNode){
                currentTimeNode.miminumSamplingInterval = 250;
            }

        }

        function bindServerCapabilities() {

            bindStandardArray(VariableIds.Server_ServerCapabilities_ServerProfileArray,
                DataType.String, "String", function () {
                    return self.serverCapabilities.serverProfileArray;
                });

            bindStandardArray(VariableIds.Server_ServerCapabilities_LocaleIdArray,
                DataType.String, "LocaleId", function () {
                    return self.serverCapabilities.localeIdArray;
                });

            bindStandardScalar(VariableIds.Server_ServerCapabilities_MinSupportedSampleRate,
                DataType.Duration, function () {
                    return self.serverCapabilities.minSupportedSampleRate;
                });

            bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxBrowseContinuationPoints,
                DataType.UInt16, function () {
                    return self.serverCapabilities.maxBrowseContinuationPoints;
                });

            bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxQueryContinuationPoints,
                DataType.UInt16, function () {
                    return self.serverCapabilities.maxQueryContinuationPoints;
                });

            bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxHistoryContinuationPoints,
                DataType.UInt16, function () {
                    return self.serverCapabilities.maxHistoryContinuationPoints;
                });

            bindStandardArray(VariableIds.Server_ServerCapabilities_SoftwareCertificates,
                DataType.ByteString, "SoftwareCertificates", function () {
                    return self.serverCapabilities.softwareCertificates;
                });

            bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxArrayLength,
                DataType.UInt32, function () {
                    return self.serverCapabilities.maxArrayLength;
                });

            bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxStringLength,
                DataType.UInt32, function () {
                    return self.serverCapabilities.maxStringLength;
                });

           function bindOperationLimits(operationLimits) {

                assert(_.isObject(operationLimits));

                function upperCaseFirst(str) {
                    return str.slice(0, 1).toUpperCase() + str.slice(1);
                }

                //Xx bindStandardArray(VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerWrite,
                //Xx     DataType.UInt32, "UInt32", function () {  return operationLimits.maxNodesPerWrite;  });
                var keys = Object.keys(operationLimits);

                keys.forEach(function (key) {

                    var uid = "Server_ServerCapabilities_OperationLimits_" + upperCaseFirst(key);
                    var nodeId = makeNodeId(VariableIds[uid]);
                    //xx console.log("xxx Binding ".bgCyan,uid,nodeId.toString());
                    assert(!nodeId.isEmpty());

                    bindStandardScalar(VariableIds[uid],
                        DataType.UInt32, function () {
                            return operationLimits[key];
                        });
                });
            }
            bindOperationLimits(self.serverCapabilities.operationLimits);

        }

        bindServerDiagnostics();

        bindServerStatus();

        bindServerCapabilities();

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

        self.__internal_bindMethod(makeNodeId(MethodIds.Server_GetMonitoredItems), getMonitoredItemsId.bind(self));

        function prepareServerDiagnostics() {

            var addressSpace = self.addressSpace;

            if (!addressSpace.rootFolder.objects) {
                return;
            }
            var server = addressSpace.rootFolder.objects.server;

            if (!server) {
                return;
            }

            // create SessionsDiagnosticsSummary
            var serverDiagnostics = server.getComponentByName("ServerDiagnostics");

            if (!serverDiagnostics) {
                return;
            }
            var subscriptionDiagnosticsArray = serverDiagnostics.getComponentByName("SubscriptionDiagnosticsArray");

            assert(subscriptionDiagnosticsArray instanceof UAVariable);

            eoan.bindExtObjArrayNode(subscriptionDiagnosticsArray,"SubscriptionDiagnosticsType","subscriptionId");


        }
        prepareServerDiagnostics();



        self.status = "initialized";
        setImmediate(callback);

    });

};

var UAVariable = require("lib/address_space/ua_variable").UAVariable;


require("lib/address_space/address_space_add_method");

var Argument = require("lib/datamodel/argument_list").Argument;

ServerEngine.prototype.__findObject = function (nodeId) {
    // coerce nodeToBrowse to NodeId
    try {
        nodeId = resolveNodeId(nodeId);
    }
    catch (err) {
        return null;
    }
    assert(nodeId instanceof NodeId);
    return this.addressSpace.findNode(nodeId);
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

    // create default browseDescription
    browseDescription = browseDescription || {};
    browseDescription.browseDirection = browseDescription.browseDirection || BrowseDirection.Forward;


    var self = this;
    assert(self.addressSpace instanceof AddressSpace); // initialize not called
    assert(browseDescription.browseDirection);

    //xx console.log(util.inspect(browseDescription,{colors:true,depth:5}));
    browseDescription = browseDescription || {};

    if (typeof nodeId === "string") {
        var node = self.addressSpace.findNode(self.addressSpace.resolveNodeId(nodeId));
        if (node) {
            nodeId = node.nodeId;
        }
    }


    var browseResult = {
        statusCode: StatusCodes.Good,
        continuationPoint: null,
        references: null
    };
    if (browseDescription.browseDirection === BrowseDirection.Invalid) {
        browseResult.statusCode = StatusCodes.BadBrowseDirectionInvalid;
        return new BrowseResult(browseResult);
    }

    // check if referenceTypeId is correct
    if (browseDescription.referenceTypeId instanceof NodeId) {
        if (browseDescription.referenceTypeId.value === 0) {
            browseDescription.referenceTypeId = null;
        } else {
            var rf = self.addressSpace.findNode(browseDescription.referenceTypeId);
            if (!rf || !(rf instanceof ReferenceType)) {
                browseResult.statusCode = StatusCodes.BadReferenceTypeIdInvalid;
                return new BrowseResult(browseResult);
            }
        }
    }

    var obj = self.__findObject(nodeId);
    if (!obj) {
        // Object Not Found
        browseResult.statusCode = StatusCodes.BadNodeIdUnknown;
        //xx console.log("xxxxxx browsing ",nodeId.toString() , " not found" );
    } else {
        browseResult.statusCode = StatusCodes.Good;
        browseResult.references = obj.browseNode(browseDescription, session);
    }
    return new BrowseResult(browseResult);
};

/**
 *
 * @method browse
 * @param nodesToBrowse {BrowseDescription[]}
 * @param [session] {ServerSession}
 * @return {BrowseResult[]}
 */
ServerEngine.prototype.browse = function (nodesToBrowse, session) {
    var self = this;
    assert(self.addressSpace instanceof AddressSpace); // initialize not called
    assert(_.isArray(nodesToBrowse));

    var results = [];
    nodesToBrowse.forEach(function (browseDescription) {


        var nodeId = resolveNodeId(browseDescription.nodeId);

        var r = self.browseSingleNode(nodeId, browseDescription, session);
        results.push(r);
    });
    return results;
};
var apply_timestamps = require("lib/datamodel/datavalue").apply_timestamps;

/**
 *
 * @method readSingleNode
 * @param nodeId
 * @param attributeId {AttributeId}
 * @param [timestampsToReturn=TimestampsToReturn.Neither]
 * @return {DataValue}
 */
ServerEngine.prototype.readSingleNode = function (nodeId, attributeId, timestampsToReturn) {


    return this._readSingleNode({
        nodeId: nodeId,
        attributeId: attributeId
    }, timestampsToReturn);
};

ServerEngine.prototype._readSingleNode = function (nodeToRead, timestampsToReturn) {

    var self = this;
    var nodeId = nodeToRead.nodeId;
    var attributeId = nodeToRead.attributeId;
    var indexRange = nodeToRead.indexRange;
    var dataEncoding = nodeToRead.dataEncoding;
    assert(self.addressSpace instanceof AddressSpace); // initialize not called

    if (timestampsToReturn === TimestampsToReturn.Invalid) {
        return new DataValue({statusCode: StatusCodes.BadTimestampsToReturnInvalid});
    }

    timestampsToReturn = (_.isObject(timestampsToReturn)) ? timestampsToReturn : TimestampsToReturn.Neither;

    var obj = self.__findObject(nodeId);

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
        var dataValue = obj.readAttribute(attributeId, indexRange, dataEncoding);

        assert(dataValue.statusCode instanceof StatusCode);
        assert(dataValue.isValid());


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
ServerEngine.prototype.read = function (readRequest) {

    assert(readRequest instanceof ReadRequest);
    assert(readRequest.maxAge >= 0);

    var self = this;
    var timestampsToReturn = readRequest.timestampsToReturn;

    var nodesToRead = readRequest.nodesToRead;

    assert(self.addressSpace instanceof AddressSpace); // initialize not called
    assert(_.isArray(nodesToRead));

    var dataValues = nodesToRead.map(function (readValueId) {
        assert(readValueId.indexRange instanceof NumericRange);
        return self._readSingleNode(readValueId, timestampsToReturn);
    });

    assert(dataValues.length === readRequest.nodesToRead.length);
    return dataValues;
};

/**
 *
 * @method writeSingleNode
 * @param writeValue {DataValue}
 * @param callback {Function}
 * @param callback.err {Error|null}
 * @param callback.statusCode {StatusCode}
 * @async
 */
ServerEngine.prototype.writeSingleNode = function (writeValue, callback) {

    var self = this;
    assert(_.isFunction(callback));
    assert(writeValue._schema.name === "WriteValue");
    assert(writeValue.value instanceof DataValue);

    if (writeValue.value.value === null) {
        return callback(null, StatusCodes.BadTypeMismatch);
    }

    assert(writeValue.value.value instanceof Variant);
    assert(self.addressSpace instanceof AddressSpace); // initialize not called

    var nodeId = writeValue.nodeId;

    var obj = self.__findObject(nodeId);
    if (!obj) {
        callback(null, StatusCodes.BadNodeIdUnknown);
    } else {
        obj.writeAttribute(writeValue, callback);
    }
};


var WriteValue = require("lib/services/write_service").WriteValue;

/**
 * write a collection of nodes
 * @method write
 * @param nodesToWrite {Object[]}
 * @param callback {Function}
 * @param callback.err
 * @param callback.results {StatusCode[]}
 * @async
 */
ServerEngine.prototype.write = function (nodesToWrite, callback) {

    assert(_.isFunction(callback));

    var self = this;

    assert(self.addressSpace instanceof AddressSpace); // initialize not called

    function performWrite(writeValue, inner_callback) {
        assert(writeValue instanceof WriteValue);
        self.writeSingleNode(writeValue, inner_callback);
    }

    async.map(nodesToWrite, performWrite, function (err, statusCodes) {

        assert(_.isArray(statusCodes));
        callback(err, statusCodes);

    });

};

/**
 *
 * @method historyReadSingleNode
 * @param nodeId
 * @param attributeId {AttributeId}
 * @param historyReadDetails {HistoryReadDetails}
 * @param [timestampsToReturn=TimestampsToReturn.Neither]
 * @param callback {Function}
 * @param callback.err
 * @param callback.results {HistoryReadResult}
 */
ServerEngine.prototype.historyReadSingleNode = function (nodeId, attributeId, historyReadDetails, timestampsToReturn, callback) {

    this._historyReadSingleNode({
        nodeId: nodeId,
        attributeId: attributeId
    }, historyReadDetails, timestampsToReturn, callback);
};

ServerEngine.prototype._historyReadSingleNode = function (nodeToRead, historyReadDetails, timestampsToReturn, callback) {

    var self = this;
    var nodeId = nodeToRead.nodeId;
    var indexRange = nodeToRead.indexRange;
    var dataEncoding = nodeToRead.dataEncoding;
    var continuationPoint = nodeToRead.continuationPoint;
    assert(self.addressSpace instanceof AddressSpace); // initialize not called

    if (timestampsToReturn === TimestampsToReturn.Invalid) {
        return new DataValue({statusCode: StatusCodes.BadTimestampsToReturnInvalid});
    }

    timestampsToReturn = (_.isObject(timestampsToReturn)) ? timestampsToReturn : TimestampsToReturn.Neither;

    var obj = self.__findObject(nodeId);

    if (!obj) {
        // may be return BadNodeIdUnknown in dataValue instead ?
        // Object Not Found
        callback(null, new HistoryReadResult({statusCode: StatusCodes.BadNodeIdUnknown}));
    } else {

        // check access
        //    BadUserAccessDenied
        //    BadNotReadable
        //    invalid attributes : BadNodeAttributesInvalid
        //    invalid range      : BadIndexRangeInvalid
        obj.historyRead(historyReadDetails, indexRange, dataEncoding, continuationPoint, function(err, result){
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
ServerEngine.prototype.historyRead = function (historyReadRequest, callback) {

    assert(historyReadRequest instanceof HistoryReadRequest);
    assert(_.isFunction(callback));

    var self = this;
    var timestampsToReturn = historyReadRequest.timestampsToReturn;
    var historyReadDetails = historyReadRequest.historyReadDetails;

    var nodesToRead = historyReadRequest.nodesToRead;

    assert(historyReadDetails instanceof HistoryReadDetails);
    assert(self.addressSpace instanceof AddressSpace); // initialize not called
    assert(_.isArray(nodesToRead));

    var historyData=[];
    async.eachSeries(nodesToRead, function(readValueId, cbNode){
        self._historyReadSingleNode(readValueId, historyReadDetails, timestampsToReturn, function(err, result){

            if (err && !result) {
                result=new HistoryReadResult({statusCode: StatusCodes.BadInternalError});
            }
            historyData.push(result);
            async.setImmediate(cbNode); //it's not guaranteed that the historical read process is really asynchronous
        });
    }, function(err){
        assert(historyData.length === nodesToRead.length);
        callback(err, historyData);
    });
};

function __bindVariable(self,nodeId,options) {
    options = options || {};
    // must have a get and a set property
    assert(_.difference(["get", "set"], _.keys(options)).length === 0);

    var obj = self.addressSpace.findNode(nodeId);
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

    var self = this;
    assert(_.isFunction(func));
    assert(nodeId instanceof NodeId);

    var methodNode = self.addressSpace.findNode(nodeId);
    if (!methodNode) {
        return;
    }
    if (methodNode && methodNode.bindMethod) {
        methodNode.bindMethod(func);
    } else {
        //xx console.log((new Error()).stack);
        console.log("WARNING:  cannot bind a method with id ".yellow + nodeId.toString().cyan + ". please check your nodeset.xml file or add this node programmatically".yellow);
        console.log(require("lib/misc/utils").trace_from_this_projet_only(new Error()))
    }
};

ServerEngine.prototype.getOldestUnactivatedSession = function() {

    var self = this;
    var tmp = _.filter(self._sessions, function(session){
        return session.status === "new";
    });
    if (tmp.length === 0) {
        return null;
    }
    var session = tmp[1];
    for (var i=1;i<session.length;i++) {
        var c = tmp[i];
        if (session.creationDate.getTime() < c.creationDate.getTime()) {
            session = c;
        }
    }
    return session;
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

    var self = this;

    self.serverDiagnosticsSummary.cumulatedSessionCount += 1;

    self.clientDescription = options.clientDescription || new ApplicationDescription({});

    var sessionTimeout = options.sessionTimeout || 1000;

    assert(_.isNumber(sessionTimeout));

    var session = new ServerSession(self, self.cumulatedSessionCount, sessionTimeout);

    var key = session.authenticationToken.toString();

    self._sessions[key] = session;

    // see spec OPC Unified Architecture,  Part 2 page 26 Release 1.02
    // TODO : When a Session is created, the Server adds an entry for the Client
    // in its SessionDiagnosticsArray Variable


    session.on("new_subscription", function (subscription) {

        self.serverDiagnosticsSummary.cumulatedSubscriptionCount += 1;

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
        self.serverDiagnosticsSummary.sessionTimeoutCount += 1;
        session.sessionName = session.sessionName || "";

        console.log("Server: closing SESSION ".cyan, session.status, session.sessionName.yellow, " because of timeout = ".cyan, session.sessionTimeout, " has expired without a keep alive".cyan);
        var channel = session.channel;
        if (channel) {
            console.log("channel = ".bgCyan,channel.remoteAddress," port = ",channel.remotePort);
        }

        // If a Server terminates a Session for any other reason, Subscriptions  associated with the Session,
        // are not deleted. => deleteSubscription= false
        self.closeSession(session.authenticationToken, /*deleteSubscription=*/false,/* reason =*/"Timeout");
    });

    return session;
};

/**
 * @method closeSession
 * @param authenticationToken
 * @param {Boolean} deleteSubscriptions : true if sessions's subscription shall be deleted
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
ServerEngine.prototype.closeSession = function (authenticationToken, deleteSubscriptions,reason) {

    var self = this;

    reason  = reason || "CloseSession";
    assert(_.isString(reason));
    assert(reason === "Timeout" || reason==="Terminated" || reason === "CloseSession" || reason === "Forcing");

    debugLog("ServerEngine.closeSession ", authenticationToken.toString(), deleteSubscriptions);

    var key = authenticationToken.toString();
    var session = self.getSession(key);
    assert(session);

    session.close(deleteSubscriptions,reason);

    assert(session.status === "closed");
    self._closedSessions[key] = session;

    delete self._sessions[key];

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

    var self = this;
    if (!authenticationToken || ( authenticationToken.identifierType && ( authenticationToken.identifierType.value !== NodeIdType.BYTESTRING.value))) {
        return null;     // wrong type !
    }
    var key = authenticationToken.toString();
    var session = self._sessions[key];
    if (!activeOnly && !session) {
        session = self._closedSessions[key];
    }
    return session;
};


/**
 * @method browsePath
 * @param browsePath
 * @return {BrowsePathResult}
 */
ServerEngine.prototype.browsePath = function (browsePath) {
    return this.addressSpace.browsePath(browsePath);
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

    var self = this;

    // filter out nodeIds
    // ... for which the caller wants to read the Value attribute
    //     assuming that Value is requested if attributeId is missing,
    nodesToRefresh = _.filter(nodesToRefresh, function (n) {
        return (!n.attributeId || n.attributeId === AttributeIds.Value);
    });

    // ... and that are valid object and instances of Variables ...
    var objs = _.map(nodesToRefresh, function (n) {
        return self.addressSpace.findNode(n.nodeId);
    });
    objs = _.filter(objs, function (n) {
        return n && n instanceof UAVariable;
    });

    // ... and that have been declared as asynchronously updating
    objs = _.filter(objs, function (o) {
        return _.isFunction(o.refreshFunc);
    });

    // ... avoiding duplication
    objs = _.uniq(objs, false, function (o) {
        return o.nodeId.toString();
    });

    // perform all asyncRefresh in parallel
    async.map(objs, function (obj, inner_callback) {
        obj.asyncRefresh(inner_callback);
    }, function (err, arrResult) {
        callback(err, arrResult);
    });

};

exports.ServerEngine = ServerEngine;

