"use strict";
/**
 * @module opcua.server
 */

require("requirish")._(module);
var assert = require("better-assert");


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

var BaseNode = require("lib/address_space/basenode").BaseNode;


var EventEmitter = require("events").EventEmitter;

//
var ServerState = require("schemas/ServerState_enum").ServerState;
var ServerStatus = require("_generated_/_auto_generated_ServerStatus").ServerStatus;


var constructFilename = require("lib/misc/utils").constructFilename;

var standard_nodeset_file = constructFilename("nodesets/Opc.Ua.NodeSet2.xml");
exports.standard_nodeset_file = standard_nodeset_file;

var mini_nodeset_filename = constructFilename("lib/server/mini.Node.Set2.xml");
exports.mini_nodeset_filename = mini_nodeset_filename;


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


        function bindVariableIfPresent(nodeId, options) {
            if (self.findObject(nodeId)) {
                self.bindVariable(nodeId, options);
            }
        }

        bindVariableIfPresent(makeNodeId(VariableIds.Server_ServerStatus), {

            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentRead",
            dataType: ServerStatus.prototype.encodingDefaultBinary,
            // already set : dataType: "ServerStatusDataType",
            get: function () {
                var serverStatus = new ServerStatus({
                    "startTime": self.startTime,
                    "currentTime": new Date(),
                    "state": self.serverState,
                    "buildInfo": self.buildInfo,
                    "secondsTillShutdown": 10,
                    "shutdownReason": {text: self.shutdown_reason}
                });
                return new Variant({
                    dataType: DataType.ExtensionObject,
                    value: serverStatus
                });
            },
            set: null
        });


        bindVariableIfPresent(makeNodeId(VariableIds.Server_ServerStatus_BuildInfo), {

            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentRead",
            dataType: BuildInfo.prototype.encodingDefaultBinary,
            get: function () {
                return new Variant({
                    dataType: DataType.ExtensionObject,
                    value: self.buildInfo
                });
            },
            set: null
        });

        // -------------------------------------------- install default get/put handler
        var server_NamespaceArray_Id = makeNodeId(VariableIds.Server_NamespaceArray); // ns=0;i=2255
        bindVariableIfPresent(server_NamespaceArray_Id, {
            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentRead",
            dataType: "String",
            get: function () {
                return new Variant({
                    dataType: DataType.String,
                    arrayType: VariantArrayType.Array,
                    value: [
                        "http://opcfoundation.org/UA/", // namespace 0 is standard namespace
                        self.serverNamespaceUrn         // namespace 1 is our's
                    ]
                });
            },
            set: null // read only
        });

        var server_ServerArray_Id = makeNodeId(VariableIds.Server_ServerArray); // ns=0;i=2254
        bindVariableIfPresent(server_ServerArray_Id, {
            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentRead",
            dataType: "String",
            get: function () {
                return new Variant({
                    dataType: DataType.String,
                    arrayType: VariantArrayType.Array,
                    value: [
                        self.serverNameUrn // this is us !
                    ]
                });
            },
            set: null // read only
        });

        var server_ServerStatus_State = makeNodeId(VariableIds.Server_ServerStatus_State); // ns=0;i=2259
        bindVariableIfPresent(server_ServerStatus_State, {
            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentRead",
            dataType: "ServerState",
            get: function () {
                return new Variant({
                    dataType: DataType.UInt32,
                    value: self.serverState
                });
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

/**
 *
 * @method getFolder
 * @param folder   {Object|String|NodeId} the folder identifier either as an object, a nodeid string, or a NodeId.
 * @return {UAObject}  hasTypeDefinition: FolderType
 */
ServerEngine.prototype.getFolder = function (folder) {
    var self = this;

    if (folder instanceof BaseNode) {
        // already a folder (?)
        // TODO make sure the folder exists in the address space and that the folder object is a Folder
        return folder;
    }

    assert(self.address_space instanceof AddressSpace); // initialize not called

    folder = self.address_space.findObjectByBrowseName(folder) || folder;
    if (!folder || !folder.hasTypeDefinition) {
        folder = self.address_space.findObject(folder) || folder;
        if (!folder || !folder.hasTypeDefinition) {
            console.log("cannot find folder ", folder);
            return null; // canno
        }
    }
    assert(self.FolderTypeId, " ????");
    assert(folder.hasTypeDefinition.toString() === self.FolderTypeId.toString(), "expecting a Folder here ");
    return folder;
};

ServerEngine.prototype.addComponentInFolder = function (parentFolder /*, childObject */) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called

    if (typeof parentFolder === "string") {
        // coerce parent folder to an object
        parentFolder = self.getFolder(parentFolder);
    }

    // var references = [
    //    { referenceType: "Organizes", isForward: false, nodeId: childObject.nodeId }
    //];

    // TODO
};

/**
 *
 * @method createFolder
 * @param parentFolder
 * @param options {String|Object}
 * @param options.browseName {String} the name of the folder
 * @param [options.nodeId] {NodeId}. An optional nodeId for this object
 *
 * @return {BaseNode}
 */
ServerEngine.prototype.createFolder = function (parentFolder, options) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called

    if (typeof parentFolder === "string") {
        // coerce parent folder to an object
        parentFolder = self.getFolder(parentFolder);
    }

    if (typeof options === "string") {
        options = {browseName: options};
    }

    options.nodeId = options.nodeId || this._build_new_NodeId();
    options.nodeClass = NodeClass.Object;
    options.references = [
        {referenceType: "HasTypeDefinition", isForward: true, nodeId: self.FolderTypeId},
        {referenceType: "Organizes", isForward: false, nodeId: parentFolder.nodeId}
    ];

    var folder = self.address_space._createObject(options);

    folder.propagate_back_references(self.address_space);
    assert(folder.parent === parentFolder.nodeId);

    return folder;
};

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


var Variable = require("lib/address_space/variable").Variable;
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
 * @return {Variable}
 *
 */
ServerEngine.prototype.addVariable = function (parentObject, options) {
    var self = this;
    return self.address_space.addVariable(parentObject, options);
};


/**

 @method addVariableInFolder
 @param parentFolder {Object|String} the name of the parent folder
 @param options {Object} see {{#crossLink "ServerEngine/addVariable"}}{{/crossLink}}
 @return {Variable}
 */
ServerEngine.prototype.addVariableInFolder = function (parentFolder, options) {
    var self = this;
    parentFolder = self.getFolder(parentFolder);
    assert(parentFolder); // parent folder must exist
    assert(parentFolder instanceof BaseNode); // parent folder must exist
    return self.addVariable(parentFolder, options);
};


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

    assert(_.isObject(parentObject));
    parentObject = self.getFolder(parentObject);

    var newNodeId = options.nodeId || self._build_new_NodeId();
    options.nodeId = newNodeId;
    options.nodeClass = NodeClass.Method;

    assert(options.hasOwnProperty("browseName"));
    assert(options.hasOwnProperty("inputArguments") && _.isArray(options.inputArguments));
    assert(options.hasOwnProperty("outputArguments") && _.isArray(options.outputArguments));

    var method = self.addObjectInFolder(parentObject, options);

    var nodeId_ArgumentDataType = "Argument"; // makeNodeId(DataTypeIds.Argument);

    var _inputArgs = new Variant({
        dataType: DataType.ExtensionObject,
        arrayType: VariantArrayType.Array,
        value: options.inputArguments.map(function (options) {
            return new Argument(options);
        })
    });

    var inputArguments = self.addVariable(method, {
        typeDefinition: "PropertyType",
        browseName: "InputArguments",
        description: "the definition of the input argument of method " + parentObject.browseName + "." + method.browseName,
        nodeId: self._build_new_NodeId(),
        dataType: nodeId_ArgumentDataType,
        valueRank: 1,
        minimumSamplingInterval: -1,
        arrayDimensions: [_inputArgs.value.length],
        value: {
            get: function () {
                return _inputArgs;
            }
        }
    });

    var _ouputArgs = new Variant({
        dataType: DataType.ExtensionObject,
        arrayType: VariantArrayType.Array,
        value: options.outputArguments.map(function (options) {
            return new Argument(options);
        })
    });

    var outputArguments = self.addVariable(method, {
        typeDefinition: "PropertyType",
        browseName: "OutputArguments",
        description: "the definition of the output arguments of method " + parentObject.browseName + "." + method.browseName,
        nodeId: self._build_new_NodeId(),
        dataType: nodeId_ArgumentDataType,
        valueRank: 1,
        minimumSamplingInterval: -1,
        arrayDimensions: [_ouputArgs.value.length],
        value: {
            get: function () {
                return _ouputArgs;
            }
        }
    });

    // verifying postconditions
    var propertyTypeId = self.address_space._coerce_VariableTypeIds("PropertyType");

    console.log(" propertyTypeId = ", propertyTypeId, outputArguments.hasTypeDefinition);
    assert(outputArguments.hasTypeDefinition.toString() === propertyTypeId.toString());
    assert(inputArguments.hasTypeDefinition.toString() === propertyTypeId.toString());
    assert(_.isArray(inputArguments.arrayDimensions));
    assert(_.isArray(outputArguments.arrayDimensions));

    return method;
};

/**
 * @method addObjectInFolder
 * @param parentObject {Object}
 * @param options {Object}
 * @param [options.nodeId=null] {NodeId} the object nodeid.
 * @param [options.browseName=""] {String} the object browse name.
 * @param [options.description=""] {String} the object description.
 * @param options.eventNotifier {Number} the event notifier flag.
 * @return {Object}
 */
ServerEngine.prototype.addObjectInFolder = function (parentObject, options) {

    var self = this;
    parentObject = self.getFolder(parentObject);

    assert(self.address_space instanceof AddressSpace);
    assert(options.hasOwnProperty("browseName") && options.browseName.length > 0);
    assert(parentObject && parentObject.nodeId); // should have a valid parent folder
    //xx assert(parentFolder instanceof BaseNode); // parent folder must exist

    var nodeClass = options.nodeClass || NodeClass.Object;

    var obj = self.address_space._createObject({
        nodeClass: nodeClass,
        isAbstract: false,
        nodeId: options.nodeId || null,
        browseName: options.browseName,
        description: options.description || "",
        eventNotifier: options.eventNotifier,
        references: [
            {referenceType: "HasTypeDefinition", isForward: true, nodeId: self.BaseObjectTypeId},
            {referenceType: "ComponentOf", isForward: true, nodeId: parentObject.nodeId}
        ]
    });
    assert(obj.nodeId !== null);

    obj.propagate_back_references(self.address_space);

    return obj;
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
    var obj = this.findObject(nodeId);
    return obj;
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

    var obj = self.__findObject(nodeId);

    var browseResult = {
        statusCode: StatusCodes.Good,
        continuationPoint: null,
        references: null
    };

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

function apply_timestamps(dataValue, timestampsToReturn, attributeId) {

    assert(dataValue instanceof DataValue);

    assert(dataValue.hasOwnProperty("serverTimestamp"));
    assert(dataValue.hasOwnProperty("sourceTimestamp"));
    // apply timestamps
    switch (timestampsToReturn) {
        case TimestampsToReturn.Neither:
            dataValue.serverTimestamp = null;
            dataValue.sourceTimestamp = null;
            break;
        case TimestampsToReturn.Server:
            dataValue.serverTimestamp = new Date();
            dataValue.sourceTimestamp = null;
            break;
        case TimestampsToReturn.Source:
            dataValue.serverTimestamp = null;
            dataValue.sourceTimestamp = dataValue.sourceTimestamp || new Date();
            break;
        case TimestampsToReturn.Both:
            dataValue.serverTimestamp = new Date();
            dataValue.sourceTimestamp = dataValue.sourceTimestamp || dataValue.serverTimestamp;
            break;
    }

    // unset sourceTimestamp unless AttributeId is Value
    if (attributeId !== AttributeIds.Value) {
        dataValue.sourceTimestamp = null;
    }

}
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

    timestampsToReturn = (timestampsToReturn !== null) ? timestampsToReturn : TimestampsToReturn.Neither;

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

        apply_timestamps(dataValue, timestampsToReturn, attributeId);

        return dataValue;
    }
};

/**
 *
 * @method read
 * @param readRequest {ReadRequest}
 * @return {DataValue[]}
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
    assert(writeValue.value.value instanceof Variant);
    assert(self.address_space instanceof AddressSpace); // initialize not called

    var nodeId = writeValue.nodeId;

    var obj = self.__findObject(nodeId);
    if (!obj) {
        callback(null,StatusCodes.BadNodeIdUnknown);
    } else {
        obj.writeAttribute(writeValue.attributeId, writeValue.value, callback);
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

    function performWrite(writeValue, callback) {
        assert(writeValue instanceof WriteValue);
        return self.writeSingleNode(writeValue, callback);
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
 * @param options {Object}  see {{#crossLink "Variable/bindVariable"}}{{/crossLink}} for description of this parameter.
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
    } else {
        console.log((new Error()).stack);
        console.log(" cannot bind object with id ", nodeId.toString(), " please check your nodeset.xml file or add this node programmaticaly");
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
        new Error(" cannot bind a method with id ", nodeId.toString(), " please check your nodeset.xml file or add this node programmaticaly");
    }
};

var ServerSession = require("lib/server/server_session").ServerSession;


/**
 * create a new server session object.
 * @class ServerEngine
 * @method createSession
 * @param options
 * @param [options.sessionTimeout = 1000] {Number} sessionTimeout
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


var async = require("async");
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
        return n && n instanceof Variable;
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

