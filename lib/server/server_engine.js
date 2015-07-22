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

var VariableIds = require("lib/opcua_node_ids").VariableIds;
var MethodIds = require("lib/opcua_node_ids").MethodIds;

var ReferenceType = require("lib/address_space/referenceType").ReferenceType;


var EventEmitter = require("events").EventEmitter;

//
var ServerState = require("schemas/ServerState_enum").ServerState;
var ServerStatus = require("_generated_/_auto_generated_ServerStatus").ServerStatus;


var constructFilename = require("lib/misc/utils").constructFilename;

var standard_nodeset_file = constructFilename("nodesets/Opc.Ua.NodeSet2.xml");
exports.standard_nodeset_file = standard_nodeset_file;

var mini_nodeset_filename = constructFilename("lib/server/mini.Node.Set2.xml");
exports.mini_nodeset_filename = mini_nodeset_filename;

var part8_nodeset_filename = constructFilename("nodesets/Opc.Ua.NodeSet2.Part8.xml");
exports.part8_nodeset_filename = part8_nodeset_filename;


var debugLog = require("lib/misc/utils").make_debugLog(__filename);
//var doDebug = require("lib/misc/utils").checkDebugFlag(__filename);

var ServerCapabilities = require("./server_capabilities").ServerCapabilities;
/**
 * @class ServerEngine
 * @extends EventEmitter
 * @uses ServerSidePublishEngine
 * @constructor
 */
function ServerEngine(options) {

    options = options || {};
    options.buildInfo = options.buildInfo || {};

    EventEmitter.apply(this, arguments);

    this._session_counter = 0;
    this._sessions = {};
    this._closedSessions = {};

    this.startTime = new Date();

    this.status = "creating";

    this.setServerState(ServerState.NoConfiguration);

    this.address_space = null;

    this.buildInfo = new BuildInfo(options.buildInfo);

    this._cumulatedSubscriptionCount = 0;
    this._rejectedSessionCount = 0;
    this._rejectedRequestsCount = 0;
    this._sessionAbortCount = 0;
    this._publishingIntervalCount = 0;
    this._sessionTimeoutCount = 0;

    this.serverCapabilities = new ServerCapabilities(options.serverCapabilities);

    this._shutdownTask = [];

    this._applicationUri = options.applicationUri || "<unset _applicationUri>";
}

util.inherits(ServerEngine, EventEmitter);


/**
 * register a function that will be called when the server will perform its shut down.
 * @method registerShutdownTask
 */
ServerEngine.prototype.registerShutdownTask = function (task) {
    assert(_.isFunction(task));
    this._shutdownTask.push(task);

};

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
        self.closeSession(token, true);
    });

    // all sessions must have been terminated
    assert(self.currentSessionCount === 0);

    // perform registerShutdownTask
    self._shutdownTask.forEach(function (task) {
        task.call(this);
    });
};

/**
 * the number of active sessions
 * @property currentSessionCount
 * @type {Number}
 */
ServerEngine.prototype.__defineGetter__("currentSessionCount", function () {
    return Object.keys(this._sessions).length;
});

/**
 * the cumulated number of sessions that have been opened since this object exists
 * @property cumulatedSessionCount
 * @type {Number}
 */
ServerEngine.prototype.__defineGetter__("cumulatedSessionCount", function () {
    return this._session_counter;
});

/**
 * the number of active subscriptions.
 * @property currentSubscriptionCount
 * @type {Number}
 */
ServerEngine.prototype.__defineGetter__("currentSubscriptionCount", function () {
    // currentSubscriptionCount returns the total number of subscriptions
    // that are currently active on all sessions
    var counter = 0;
    _.values(this._sessions).forEach(function (session) {
        counter += session.currentSubscriptionCount;
    });
    return counter;
});

/**
 * the cumulated number of subscriptions that have been created since this object exists
 * @property cumulatedSubscriptionCount
 * @type {Number}
 */
ServerEngine.prototype.__defineGetter__("cumulatedSubscriptionCount", function () {
    // TODO: fix this question:
    //  shall we return the cumulatedSubscriptionCount of the calling session or
    //  the total of subscription count that have been ever created by all sessions ?
    return this._cumulatedSubscriptionCount;
});


ServerEngine.prototype.__defineGetter__("rejectedSessionCount", function () {
    return this._rejectedSessionCount;
});

ServerEngine.prototype.__defineGetter__("rejectedRequestsCount", function () {
    return this._rejectedRequestsCount;
});

ServerEngine.prototype.__defineGetter__("sessionAbortCount", function () {
    return this._sessionAbortCount;
});
ServerEngine.prototype.__defineGetter__("sessionTimeoutCount", function () {
    return this._sessionTimeoutCount;
});

ServerEngine.prototype.__defineGetter__("publishingIntervalCount", function () {
    return this._publishingIntervalCount;
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
    return this.buildInfo.productName;
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
    this.serverState = serverState;
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
    assert(!self.address_space); // check that 'initialize' has not been already called

    self.status = "initializing";

    self.shutdown_reason = "";

    options = options || {};
    assert(_.isFunction(callback));

    options.nodeset_filename = options.nodeset_filename || standard_nodeset_file;

    var startTime = new Date();

    debugLog("Loading ", options.nodeset_filename, "...");

    self.address_space = new AddressSpace();

    // register namespace 1 (our namespace);
    var serverNamespaceIndex = self.address_space.registerNamespace(self.serverNamespaceUrn);
    assert(serverNamespaceIndex === 1);

    generate_address_space(self.address_space, options.nodeset_filename, function () {

        var endTime = new Date();
        debugLog("Loading ", options.nodeset_filename, " done : ", endTime - startTime, " ms");

        function findObjectNodeId(name) {
            var obj = self.findObject(name);
            return obj ? obj.nodeId : null;
        }

        self.FolderTypeId = findObjectNodeId("FolderType");
        self.BaseObjectTypeId = findObjectNodeId("BaseObjectType");
        self.BaseDataVariableTypeId = findObjectNodeId("BaseDataVariableType");

        self.rootFolder = self.findObject("RootFolder");
        assert(self.rootFolder.readAttribute);

        self.setServerState(ServerState.Running);

        function bindVariableIfPresent(nodeId, opts) {
            if (self.findObject(nodeId)) {
                self.bindVariable(nodeId, opts);
            }
        }

        var serverStatus = new ServerStatus({
            startTime: self.startTime,
            currentTime: new Date(),
            state: self.serverState,
            buildInfo: self.buildInfo,
            secondsTillShutdown: 10,
            shutdownReason: {text: self.shutdown_reason}
        });
        var serverStatus_var = new Variant({
            dataType: DataType.ExtensionObject,
            value: serverStatus
        });

        bindVariableIfPresent(makeNodeId(VariableIds.Server_ServerStatus), {

            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentRead",
            dataType: ServerStatus.prototype.encodingDefaultBinary,
            get: function () {
                return serverStatus_var;
            },
            set: null
        });


        var buildInfo_var = new Variant({
            dataType: DataType.ExtensionObject,
            value: self.buildInfo
        });

        bindVariableIfPresent(makeNodeId(VariableIds.Server_ServerStatus_BuildInfo), {

            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentRead",
            dataType: BuildInfo.prototype.encodingDefaultBinary,
            get: function () {
                return buildInfo_var;
            },
            set: null
        });


        // -------------------------------------------- install default get/put handler
        var server_NamespaceArray_Id = makeNodeId(VariableIds.Server_NamespaceArray); // ns=0;i=2255
        bindVariableIfPresent(server_NamespaceArray_Id, {
            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentRead",
            dataType: "String",
            valueRank: 1,
            get: function () {
                return new Variant({
                    dataType: DataType.String,
                    arrayType: VariantArrayType.Array,
                    value: self.address_space.getNamespaceArray()
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
            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentRead",
            dataType: "String",
            valueRank: 1, // Array
            get: function () {
                return server_NameUrn_var;
            },
            set: null // read only
        });

        var server_ServerStatus_State = makeNodeId(VariableIds.Server_ServerStatus_State); // ns=0;i=2259
        var serverState_var = new Variant({
            dataType: DataType.UInt32,
            value: self.serverState
        });
        bindVariableIfPresent(server_ServerStatus_State, {
            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentRead",
            dataType: "ServerState",
            get: function () {
                return serverState_var;
            },
            set: null // read only
        });

        function bindStandardScalar(id, dataType, func) {

            assert(_.isNumber(id));
            assert(_.isFunction(func));
            assert(dataType !== null); // check invalid dataType

            var nodeId = makeNodeId(id);

            // make sur the provided function returns a valid value for the variant type
            // This test may not be exhaustive but it will detect obvious mistakes.
            assert(isValidVariant(VariantArrayType.Scalar, dataType, func()));
            bindVariableIfPresent(nodeId, {
                accessLevel: "CurrentRead",
                userAccessLevel: "CurrentRead",

                get: function () {
                    return new Variant({
                        dataType: dataType,
                        arrayType: VariantArrayType.Scalar,
                        value: func()
                    });
                },
                set: null // read only
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
                dataType: dataType,
                accessLevel: "CurrentRead",
                userAccessLevel: "CurrentRead",
                get: function () {
                    var value = func();
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
                return false;
            });


        function bindServerDiagnostics() {
            bindStandardScalar(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSubscriptionCount,
                DataType.UInt32, function () {
                    return self.currentSubscriptionCount;
                });

            bindStandardScalar(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount,
                DataType.UInt32, function () {
                    return self.currentSessionCount;
                });

            bindStandardScalar(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CumulatedSessionCount,
                DataType.UInt32, function () {
                    return self.cumulatedSessionCount;
                });

            bindStandardScalar(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CumulatedSubscriptionCount,
                DataType.UInt32, function () {
                    return self.cumulatedSubscriptionCount;
                });

            bindStandardScalar(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_RejectedRequestsCount,
                DataType.UInt32, function () {
                    return 0; // not supported yet
                });

            bindStandardScalar(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_RejectedSessionCount,
                DataType.UInt32, function () {
                    return self.rejectedSessionCount;
                });

            bindStandardScalar(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_ServerViewCount,
                DataType.UInt32, function () {
                    return 0; // not supported yet
                });

            bindStandardScalar(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_SessionTimeoutCount,
                DataType.UInt32, function () {
                    return self.sessionTimeoutCount;
                });

            bindStandardScalar(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_SessionAbortCount,
                DataType.UInt32, function () {
                    return 0; // not supported yet
                });

        }

        function bindServerStatus() {

            bindStandardScalar(VariableIds.Server_ServerStatus_StartTime,
                DataType.DateTime, function () {
                    return self.startTime;
                });

            bindStandardScalar(VariableIds.Server_ServerStatus_CurrentTime,
                DataType.DateTime, function () {
                    return new Date();
                });

            bindStandardScalar(VariableIds.Server_ServerStatus_SecondsTillShutdown,
                DataType.UInt32, function () {
                    return self.secondsTillShutdown();
                });

            bindStandardScalar(VariableIds.Server_ServerStatus_ShutdownReason,
                DataType.LocalizedText, function () {
                    return new LocalizedText({text: self.shutdownReason});
                });

            bindStandardScalar(VariableIds.Server_ServerStatus_BuildInfo_ProductName,
                DataType.String, function () {
                    return self.buildInfo.productName;
                });

            bindStandardScalar(VariableIds.Server_ServerStatus_BuildInfo_ProductUri,
                DataType.String, function () {
                    return self.buildInfo.productUri;
                });

            bindStandardScalar(VariableIds.Server_ServerStatus_BuildInfo_ManufacturerName,
                DataType.String, function () {
                    return self.buildInfo.manufacturerName;
                });

            bindStandardScalar(VariableIds.Server_ServerStatus_BuildInfo_SoftwareVersion,
                DataType.String, function () {
                    return self.buildInfo.softwareVersion;
                });

            bindStandardScalar(VariableIds.Server_ServerStatus_BuildInfo_BuildNumber,
                DataType.String, function () {
                    return self.buildInfo.buildNumber;
                });

            bindStandardScalar(VariableIds.Server_ServerStatus_BuildInfo_BuildDate,
                DataType.DateTime, function () {
                    return self.buildInfo.buildDate;
                });

        }

        function bindServerCapabilities(serverCapabilities) {

            bindStandardArray(VariableIds.Server_ServerCapabilities_ServerProfileArray,
                DataType.String, "String", function () {
                    return [];
                });

            bindStandardArray(VariableIds.Server_ServerCapabilities_LocaleIdArray,
                DataType.String, "LocaleId", function () {
                    return ["en-EN", "fr-FR"];
                });

            bindStandardScalar(VariableIds.Server_ServerCapabilities_MinSupportedSampleRate,
                DataType.Duration, function () {
                    return 0.0;
                });

            bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxBrowseContinuationPoints,
                DataType.UInt16, function () {
                    return 0.0;
                });

            bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxQueryContinuationPoints,
                DataType.UInt16, function () {
                    return 0.0;
                });

            bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxHistoryContinuationPoints,
                DataType.UInt16, function () {
                    return 0.0;
                });

            bindStandardArray(VariableIds.Server_ServerCapabilities_SoftwareCertificates,
                DataType.UInt16, "SignedSoftwareCertificate", function () {
                    return [];
                });

            bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxArrayLength,
                DataType.UInt32, function () {
                    return 0.0;
                });

            bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxStringLength,
                DataType.UInt32, function () {
                    return 0.0;
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
                    bindStandardScalar(VariableIds[uid],
                        DataType.UInt32, function () {
                            return operationLimits[key];
                        });

                });
            }

            bindOperationLimits(serverCapabilities.operationLimits);

        }

        bindServerDiagnostics();

        bindServerStatus();

        bindServerCapabilities(self.serverCapabilities);

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

        self.bindMethod(MethodIds.Server_GetMonitoredItems, getMonitoredItemsId.bind(self));

        self.status = "initialized";
        setImmediate(callback);

    });
};

/**
 * @method resolveNodeId
 * @param nodeId
 * @return {NodeId}
 */
ServerEngine.prototype.resolveNodeId = function (nodeId) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called
    return self.address_space.resolveNodeId(nodeId);
};

ServerEngine.prototype._build_new_NodeId = function () {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called
    return self.address_space._build_new_NodeId();
//xx    var nodeId = makeNodeId(this._internal_id_counter, this._private_namespace);
//xx    this._internal_id_counter += 1;
//xx    return nodeId;
};
ServerEngine.prototype.getFolder = function (folder) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called
    return self.address_space.getFolder(folder);
};


ServerEngine.prototype.addFolder = function (parentFolder, options) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called
    return self.address_space.addFolder(parentFolder, options);
};

function _DEPRECATED_RENAMED(oldName, newName) {
    return function () {
        console.log(" WARNING : method ".yellow + oldName.cyan + " is deprecated and has been renamed as ".yellow + newName.cyan);
        return this.constructor.prototype[newName].apply(this, arguments);
    };
}

ServerEngine.prototype.createFolder = _DEPRECATED_RENAMED("createdFolder", "addFolder");
ServerEngine.prototype.addVariableInFolder = _DEPRECATED_RENAMED("addVariableInFolder", "addVariable");

/**
 *
 * @method findObject
 * @param nodeId
 * @return {BaseNode}
 */
ServerEngine.prototype.findObject = function (nodeId) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called
    return self.address_space.findObject(nodeId);
};

/**
 *
 * @method findObjectByBrowseName
 * @param browseName
 * @return {BaseNode}
 * Root.Folders.Server.ServerStatus
 */
ServerEngine.prototype.findObjectByBrowseName = function (browseName) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called
    return self.address_space.findObjectByBrowseName(browseName);
};


var UAVariable = require("lib/address_space/ua_variable").UAVariable;
/**
 * add a new variable inside an object
 * @method addVariable
 * @param parentObject {Object|Folder}  : the parent Object
 * @param options
 * @param options.browseName  {String}   : the variable browse name
 * @param [options.nodeId]    {String|NodeId}   : the variable nodeid. If not specified a new nodeId will be generated
 * @param [options.historizing] {Boolean}   : default value : false
 * @param [options.valueRank] {Integer}   : default value : -1
 * @param [options.minimumSamplingInterval] [UInt32] : default value: 10 ms
 * @param options.value      {Object} : parameters describing how the value of this variable can be access.
 *                                      Same as {{#crossLink "Variable/bindVariable"}}{{/crossLink}} options parameter. see {{#crossLink "Variable/bindVariable"}}{{/crossLink}} for more info.
 * @param options.dataType   {NodeId|string} : the nodeId of the variable DataType;
 * @param options.typeDefinition {NodeId|string} : the nodeId of the HasTypeDefinition;
 * @return {UAVariable}
 *
 */
ServerEngine.prototype.addVariable = function (parentObject, options) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called
    return self.address_space.addVariable(parentObject, options);
};

require("lib/address_space/address_space_add_method");

var Argument = require("lib/datamodel/argument_list").Argument;
/**
 * @method addMethod
 * @param parentObject {Object}
 * @param options {Object}
 * @param [options.nodeId=null] {NodeId} the object nodeid.
 * @param [options.browseName=""] {String} the object browse name.
 * @param [options.description=""] {String} the object description.
 * @param options.inputArguments  {Array<Argument>}
 * @param options.outputArguments {Array<Argument>}
 * @return {Object}
 */
ServerEngine.prototype.addMethod = function (parentObject, options) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called
    return self.address_space.addMethod(parentObject, options);
};


ServerEngine.prototype.addObjectInFolder = function (parentObject, options) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called
    return self.address_space.addObjectInFolder(parentObject, options);
};

ServerEngine.prototype.addView = function (parentObject, options) {
    var self = this;
    return self.address_space.addView(parentObject, options);
};

ServerEngine.prototype.__findObject = function (nodeId) {
    // coerce nodeToBrowse to NodeId
    try {
        nodeId = resolveNodeId(nodeId);
    }
    catch (err) {
        return null;
    }
    assert(nodeId instanceof NodeId);
    return this.findObject(nodeId);
};

/**
 *
 * @method browseSingleNode
 * @param nodeId {NodeId|String} : the nodeid of the element to browse
 * @param browseDescription
 * @param browseDescription.browseDirection {BrowseDirection} :
 * @param browseDescription.referenceTypeId {String|NodeId}
 * @return {BrowseResult}
 */
ServerEngine.prototype.browseSingleNode = function (nodeId, browseDescription) {

    // create default browseDescription
    browseDescription = browseDescription || {};
    browseDescription.browseDirection = browseDescription.browseDirection || BrowseDirection.Forward;


    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called
    assert(browseDescription.browseDirection);

    //xx console.log(util.inspect(browseDescription,{colors:true,depth:5}));
    browseDescription = browseDescription || {};

    if (typeof nodeId === "string") {
        var node = self.address_space.findObjectByBrowseName(nodeId);
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
            var rf = self.findObject(browseDescription.referenceTypeId);
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
        browseResult.references = obj.browseNode(browseDescription);
    }
    return new BrowseResult(browseResult);
};

/**
 *
 * @method browse
 * @param nodesToBrowse {BrowseDescription[]}
 * @return {BrowseResult[]}
 */
ServerEngine.prototype.browse = function (nodesToBrowse) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called
    assert(_.isArray(nodesToBrowse));

    var results = [];
    nodesToBrowse.forEach(function (browseDescription) {


        var nodeId = resolveNodeId(browseDescription.nodeId);

        var r = self.browseSingleNode(nodeId, browseDescription);
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
    assert(self.address_space instanceof AddressSpace); // initialize not called

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

    assert(self.address_space instanceof AddressSpace); // initialize not called
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
    assert(self.address_space instanceof AddressSpace); // initialize not called

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

    assert(self.address_space instanceof AddressSpace); // initialize not called

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
 * bind a variable
 * @method bindVariable
 * @param nodeId {NodeId} the variable nodeid to configure.
 * @param options {Object}  see {{#crossLink "UAVariable/bindVariable"}}{{/crossLink}} for description of this parameter.
 * @return void
 *
 */
ServerEngine.prototype.bindVariable = function (nodeId, options) {

    options = options || {};

    // must have a get and a set property
    assert(_.difference(["get", "set"], _.keys(options)).length === 0);

    var obj = this.findObject(nodeId);
    if (obj && obj.bindVariable) {
        obj.bindVariable(options);
        assert(_.isFunction(obj.asyncRefresh));
        assert(_.isFunction(obj.refreshFunc));
    } else {
        //xx console.log((new Error()).stack);
        console.log("Warning: cannot bind object with id ", nodeId.toString(), " please check your nodeset.xml file or add this node programmatically");
    }
};

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
ServerEngine.prototype.bindMethod = function (nodeId, func) {

    assert(_.isFunction(func));
    var obj = this.findObject(nodeId);
    if (obj && obj.bindMethod) {
        obj.bindMethod(func);
    } else {
        //xx console.log((new Error()).stack);
        console.log("WARNING:  cannot bind a method with id ".yellow + nodeId.toString().cyan + ". please check your nodeset.xml file or add this node programmatically".yellow);
    }
};

var ServerSession = require("lib/server/server_session").ServerSession;


/**
 * create a new server session object.
 * @class ServerEngine
 * @method createSession
 * @param  [options] {Object}
 * @param  [options.sessionTimeout = 1000] {Number} sessionTimeout
 * @return {ServerSession}
 */
ServerEngine.prototype.createSession = function (options) {

    options = options || {};

    var self = this;

    self._session_counter += 1;

    var sessionTimeout = options.sessionTimeout || 1000;

    assert(_.isNumber(sessionTimeout));

    var session = new ServerSession(self, self._session_counter, sessionTimeout);

    var key = session.authenticationToken.toString();

    self._sessions[key] = session;

    // see spec OPC Unified Architecture,  Part 2 page 26 Release 1.02
    // TODO : When a Session is created, the Server adds an entry for the Client
    // in its SessionDiagnosticsArray Variable


    session.on("new_subscription", function () {
        self._cumulatedSubscriptionCount += 1;
    });

    session.on("timeout", function () {
        // the session hasn't been active for a while , probably because the client has disconnected abruptly
        // it is now time to close the session completely
        self._sessionTimeoutCount += 1;
        session.sessionName = session.sessionName || "";
        console.log("closing SESSION ".cyan, session.sessionName.yellow, " because of timeout = ".cyan, session.sessionTimeout, " has expired without a keep alive".cyan);
        self.closeSession(session.authenticationToken, true);
    });

    return session;
};

/**
 * @method closeSession
 * @param authenticationToken
 * @param {Boolean} deleteSubscriptions : true if sessions's subscription shall be deleted
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
ServerEngine.prototype.closeSession = function (authenticationToken, deleteSubscriptions) {

    var self = this;
    debugLog("ServerEngine.closeSession ", authenticationToken.toString(), deleteSubscriptions);
    var key = authenticationToken.toString();
    var session = self.getSession(key);
    assert(session);

    session.close(deleteSubscriptions);

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
    return this.address_space.browsePath(browsePath);
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
        return self.findObject(n.nodeId);
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

