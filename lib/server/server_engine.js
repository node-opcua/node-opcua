var NodeClass = require("../../lib/browse_service").NodeClass;

var NodeId = require("../../lib/nodeid").NodeId;
var resolveNodeId = require("../../lib/nodeid").resolveNodeId;
var makeNodeId = require("../../lib/nodeid").makeNodeId;
var NodeIdType = require("../../lib/nodeid").NodeIdType;

var assert = require('better-assert');
var s = require("../../lib/structures");

var browse_service = require("../../lib/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

var ReferenceType = require("../../lib/common/address_space").ReferenceType;

var read_service = require("../../lib/read_service");
var AttributeIds = read_service.AttributeIds;
var TimestampsToReturn = read_service.TimestampsToReturn;

var DataValue = require("../datavalue").DataValue;
var Variant = require("../variant").Variant;
var DataType = require("../variant").DataType;
var VariantArrayType  = require("../variant").VariantArrayType;


var util = require("util");
var crypto = require("crypto");

var HasTypeDefinition = resolveNodeId("i=40");

var StatusCodes = require("../../lib/opcua_status_code").StatusCodes;

var _ = require("underscore");

var address_space = require("../../lib/common/address_space");
var generate_address_space = require("../../lib/common/load_nodeset2").generate_address_space;

var AddressSpace = address_space.AddressSpace;
var VariableIds = require("../../lib/opcua_node_ids").Variable;

var ReferenceType= require("../../lib/common/referenceType").ReferenceType;

var ServerSidePublishEngine = require("./server_publish_engine").ServerSidePublishEngine;
var EventEmitter = require("events").EventEmitter;
var util = require("util");

/**
 *
 * @param options:
 *      {
 *          nodeset_filename:  <filename> (optional) default : mini.Node.Set2.xml
 *      }
 * @constructor
 */
function ServerEngine() {

    this._private_namespace = 1;
    this._internal_id_counter = 1000;
    this._subscription_counter = 0;
    this._subscriptions = {};

    this._session_counter = 0;
    this._sessions = {};

    this.startTime = new Date();

    this.publishEngine = new ServerSidePublishEngine();

    this.status="creating";

}
util.inherits(ServerEngine,EventEmitter);

ServerEngine.prototype.shutdown = function(){
    this.status="shutdown";
    this.publishEngine.shutdown();
    delete this.publishEngine;
    this.publishEngine = null;
};

ServerEngine.prototype.__defineGetter__("currentSessionCount",  function() { return Object.keys(this._sessions).length; });
ServerEngine.prototype.__defineGetter__("cumulatedSessionCount",function() { return this._session_counter; });

ServerEngine.prototype.initialize = function(options,callback) {

    var self = this;
    assert(!self.address_space); // check that 'initalize' has not been already called
    self.status="initializing";
    options = options || {};
    assert(_.isFunction(callback));

    var default_xmlFile1 = __dirname + "../../../code_gen/Opc.Ua.NodeSet2.xml";
    var default_xmlFile2 = __dirname+"/mini.Node.Set2.xml";
    options.nodeset_filename =  options.nodeset_filename || default_xmlFile2;

    self.address_space =  new AddressSpace();

    generate_address_space(self.address_space, options.nodeset_filename,function(){


        self.FolderTypeId = self.findObject("FolderType").nodeId;
        self.BaseDataVariableTypeId = self.findObject("BaseDataVariableType").nodeId;

        self.rootFolder = self.findObject('RootFolder');
        assert(self.rootFolder.readAttribute);


        // -------------------------------------------- install default get/put handler
        var server_NamespaceArray_Id =  makeNodeId(VariableIds.Server_NamespaceArray); // ns=0;i=2255
        self.bindVariable(server_NamespaceArray_Id,{
            get: function(){
                return new Variant({
                    dataType: DataType.String,
                    arrayType: VariantArrayType.Array,
                    value: [
                        "http://opcfoundation.org/UA/",
                        "urn:MyNODE-OPCUAServer"
                    ]
                });
            },
            set: null // read only
        });

        var server_ServerArray_Id = makeNodeId(VariableIds.Server_ServerArray); // ns=0;i=2254
        self.bindVariable(server_ServerArray_Id,{
            get: function(){
                return new Variant({
                    dataType: DataType.String,
                    arrayType: VariantArrayType.Array,
                    value: [
                        "urn:MyNODE-OPCUAServer"
                    ]
                });
            },
            set: null // read only
        });

        var server_ServerStatus_State = makeNodeId(VariableIds.Server_ServerStatus_State); // ns=0;i=2259
        self.bindVariable(server_ServerStatus_State,{
            get: function(){
                return new Variant({
                    dataType: DataType.String,
                    arrayType: VariantArrayType.Array,
                    value: [
                        "urn:MyNODE-OPCUAServer"
                    ]
                });
            },
            set: null // read only
        });

        function bindStandardScalar(id,dataType,func) {
            var nodeId = makeNodeId(id);
            self.bindVariable(nodeId,{
                get: function(){
                    return new Variant({
                        dataType: dataType,
                        arrayType: VariantArrayType.Scalar,
                        value: func()
                    });
                },
                set: null // read only
            });
        }
        bindStandardScalar(VariableIds.Server_ServerStatus_StartTime,
            DataType.DateTime,function() { return self.startTime; });

        bindStandardScalar(VariableIds.Server_ServerStatus_CurrentTime,
            DataType.DateTime,function() { return new Date(); });

        bindStandardScalar(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSubscriptionCount,
            DataType.Integer,function() {return self.currentSubscriptionCount; });

        bindStandardScalar(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CumulatedSessionCount,
            DataType.Integer,function() {return self.cumulatedSubscriptionCount; });

        bindStandardScalar(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount,
            DataType.Integer,function() {return self.currentSessionCount; });

        bindStandardScalar(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CumulatedSessionCount,
            DataType.Integer,function() {return self.cumulatedSessionCount; });

        // ServerDiagnostics.ServerDiagnosticsSummary.CurrentSubscriptionCount

        //  Server_ServerStatus_BuildInfo
        bindStandardScalar(VariableIds.Server_ServerStatus_BuildInfo_ProductName,
            DataType.String,function() { return"NODEOPCUA-SERVER"; });

        bindStandardScalar(VariableIds.Server_ServerStatus_BuildInfo_ProductUri,
            DataType.String,function() {return "URI:NODEOPCUA-SERVER"; });

        bindStandardScalar(VariableIds.Server_ServerStatus_BuildInfo_ManufacturerName,
            DataType.String,function() {return "<Manufacturer>"; });

        bindStandardScalar(VariableIds.Server_ServerStatus_BuildInfo_SoftwareVersion,
            DataType.String,function() { return "1.0"; });

        bindStandardScalar(VariableIds.Server_ServerStatus_BuildInfo_BuildNumber,
            DataType.String,function() { return 1234; });

        bindStandardScalar(VariableIds.Server_ServerStatus_BuildInfo_BuildDate,
            DataType.DateTime,function() { return new Date(2014,03,03); });


        self.status="initialized";
        setImmediate(callback);

    });

};

ServerEngine.prototype.resolveNodeId = function (nodeId) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called
    return self.address_space.resolveNodeId(nodeId);
};

ServerEngine.prototype._build_new_NodeId = function () {
    var nodeId = makeNodeId(this._internal_id_counter, this._private_namespace);
    this._internal_id_counter += 1;
    return nodeId;
};

/**
 *
 * @param folder
 * @returns {UAObject hasTypeDefinition: FolderType }
 */
ServerEngine.prototype.getFolder = function(folder) {
    var self = this;

    assert(self.address_space instanceof AddressSpace); // initialize not called

    folder = self.address_space.findObject(folder) || folder;
    if(!folder || !folder.hasTypeDefinition) {
        folder = self.address_space.findObjectByBrowseName(folder) || folder;
        if(!folder || !folder.hasTypeDefinition) {
            console.log("cannot find folder ", folder);
            return null; // canno
        }
    }
    assert(self.FolderTypeId," ????");
    assert(folder.hasTypeDefinition.toString() === self.FolderTypeId.toString(), "expecting a Folder here ");
    return folder;
};

/**
 *
 * @param parentFolder
 * @param options
 * @returns {*}
 */
ServerEngine.prototype.createFolder = function (parentFolder, options) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called

    // coerce parent folder to an object
    parentFolder = self.getFolder(parentFolder);

    if (typeof options === "string") {
        options = { browseName: options };
    }

    options.nodeId = options.nodeId || this._build_new_NodeId();
    options.nodeClass  = NodeClass.Object;
    options.references = [
        { referenceType: "HasTypeDefinition",isForward:true , nodeId: this.FolderTypeId   },
        { referenceType: "Organizes"        ,isForward:false, nodeId: parentFolder.nodeId }
    ];

    var folder = self.address_space._createObject(options);

    folder.propagate_back_references(this.address_space);
    assert( folder.parent === parentFolder.nodeId);

    return folder;
};

/**
 *
 * @param nodeId
 * @returns {BaseNode}
 */
ServerEngine.prototype.findObject = function(nodeId) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called
    return self.address_space.findObject(nodeId);
};

/**
 *
 * @param nodeId
 * @returns {BaseNode}
 * Root.Folders.Server.ServerStatus
 */
ServerEngine.prototype.findObjectByBrowseName = function(browseName) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called
    return self.address_space.findObjectByBrowseName(browseName);
};

/**
 *
 * @param parentFolder
 * @param options
 *        {
 *           browseName: "<some name>" //  [Mandatory] Variable Browse Name
 *           nodeId: somename || null // [optional]
 *           value:  {
 *              get : function() {
  *                return Variant({...});
  *             },
 *              set : function(variant) {
 *                // store
 *                return StatsCodes.Good;
 *              }
 *           }
 *           description: "<some text" // [optional]
 *        }
 * @returns {Variable}
 */
ServerEngine.prototype.addVariableInFolder = function (parentFolder, options) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called
    assert(options.hasOwnProperty("browseName"));

    parentFolder = this.getFolder(parentFolder);

    var browseName = options.browseName;
   // xx var value = options.value;

    var newNodeId = options.nodeId || this._build_new_NodeId();

    var variable = this.address_space._createObject({
        nodeId: newNodeId,
        nodeClass: NodeClass.Variable,
        browseName: browseName,
        historizing: options.historizing|| false,
        minimumSamplingInterval: options.minimumSamplingInterval || 10,
        //xx value: value,
        references: [
            { referenceType: "HasTypeDefinition",isForward:true , nodeId: this.BaseDataVariableTypeId   },
            { referenceType: "Organizes"        ,isForward:false, nodeId: parentFolder.nodeId }
        ]
    });

    variable.propagate_back_references(this.address_space);

    variable.bindVariable(options.value);
    return variable;
};

ServerEngine.prototype.MyfindObject = function(nodeId) {
    // coerce nodeToBrowse to NodeId
    nodeId = resolveNodeId(nodeId);
    assert(nodeId instanceof NodeId);
    var obj = this.findObject(nodeId);
    return obj;
};

/**
 *
 * @param nodeId
 * @param browseDirection
 * @returns {exports.BrowseResult}
 */
ServerEngine.prototype.browseSingleNode = function (nodeId, browseDescription) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called

    //xx console.log(util.inspect(browseDescription,{colors:true,depth:5}));
    browseDescription = browseDescription || {};

    if (typeof nodeId === "string" ) {
        var node = self.address_space.findObjectByBrowseName(nodeId);
        if (node) {
            nodeId = node.nodeId;
        }
    }

    var obj = this.MyfindObject(nodeId);


    var browseResult = {
        statusCode: StatusCodes.Good,
        continuationPoint: null,
        references: null
    };

    // check if referenceTypeId is correct
    if (browseDescription.referenceTypeId instanceof NodeId ) {
        if (browseDescription.referenceTypeId.value === 0 ) {
            browseDescription.referenceTypeId = null;
        } else {
            var rf = this.findObject(browseDescription.referenceTypeId);
            if (!rf || !(rf instanceof ReferenceType) ) {
                browseResult.statusCode = StatusCodes.Bad_ReferenceTypeIdInvalid;
                return new browse_service.BrowseResult(browseResult);
            }
        }
    }

    if (!obj) {
        // Object Not Found
        browseResult.statusCode = StatusCodes.Bad_NodeIdUnknown;
    } else {
        browseResult.statusCode = StatusCodes.Good;
        browseResult.references = obj.browseNode(browseDescription);
    }
    return new browse_service.BrowseResult(browseResult);
};

/**
 *
 * @param nodesToBrowse {BrowseDescription[]}
 * @returns {BrowseResult[]}
 */
ServerEngine.prototype.browse = function (nodesToBrowse) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called
    assert(_.isArray(nodesToBrowse));

    var results = [];
    var self = this;
    nodesToBrowse.forEach(function (browseDescription) {
        var nodeId = resolveNodeId(browseDescription.nodeId);

        var r = self.browseSingleNode(nodeId, browseDescription);
        results.push(r);
    });
    return results;
};

function apply_timestamps(dataValue,timestampsToReturn) {
    assert( dataValue instanceof DataValue);
//xxassert( timestampsToReturn instanceof TimestampsToReturn);

    assert(dataValue.hasOwnProperty("serverTimestamp"));
    assert(dataValue.hasOwnProperty("sourceTimestamp"));
    // apply timestamps
    switch(timestampsToReturn) {
        case TimestampsToReturn.None:
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
            dataValue.sourceTimestamp = dataValue.sourceTimestamp  || dataValue.serverTimestamp;
            break;
    }
}
/**
 *
 * @param nodeId
 * @param attributeId
 * @returns {*}
 */
ServerEngine.prototype.readSingleNode = function (nodeId, attributeId ,timestampsToReturn) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called

    timestampsToReturn = (timestampsToReturn !== null) ?timestampsToReturn : TimestampsToReturn.Neither;

    var obj = this.MyfindObject(nodeId);

    if (!obj) {
        // may be return Bad_NodeIdUnknown in dataValue instead ?
        // Object Not Found
        return new DataValue({ statusCode: StatusCodes.Bad_NodeIdUnknown });
    } else {
        // check access
        //    Bad_UserAccessDenied
        //    Bad_NotReadable
        // invalid attributes : Bad_NodeAttributesInvalid
        var dataValue = obj.readAttribute(attributeId);
        apply_timestamps(dataValue,timestampsToReturn);
        return dataValue;
    }
};

/**
 *
 * @param nodesToRead {Array of ReadValueId}
 * @returns {Array of DataValue}
 */
ServerEngine.prototype.read = function (readRequest) {

    var self = this;
    var timestampsToReturn = readRequest.timestampsToReturn;
    var nodesToRead = readRequest.nodesToRead;

    assert(self.address_space instanceof AddressSpace); // initialize not called
    assert(_.isArray(nodesToRead));
    var dataValues = nodesToRead.map(function (readValueId) {
        var nodeId = readValueId.nodeId;
        var attributeId = readValueId.attributeId;
        var indexRange = readValueId.indexRange;
        var dataEncoding = readValueId.dataEncoding;
        return self.readSingleNode(nodeId, attributeId,timestampsToReturn);
    });
    return dataValues;
};

/**
 *
 * @param writeValue
 * @returns {StatusCodes}
 */
ServerEngine.prototype.writeSingleNode = function (writeValue) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called

    var nodeId = writeValue.nodeId;

    var obj = this.MyfindObject(nodeId);
    if (!obj) {
        return StatusCodes.Bad_NodeIdUnknown;
    } else {
        return obj.write(writeValue);
    }
};

/**
 *
 * @param write
 * @returns {StatusCodes[]}
 */
ServerEngine.prototype.write = function (nodesToWrite) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called

    var statusCodes = nodesToWrite.map(function (writeValue) {
        return self.writeSingleNode(writeValue);
    });
    assert(_.isArray(statusCodes));
    return statusCodes;
};

/**
 *
 * @param nodeId
 * @param options
 */
ServerEngine.prototype.bindVariable = function( nodeId, options ){
    options = options || {};

    assert(_.difference(["get","set"], _.keys(options)).length === 0);

    var obj = this.findObject(nodeId);
    if(obj && obj.bindVariable)  {
        obj.bindVariable(options);
    }
};

function ServerSession(sessionId) {
    this.authenticationToken = new NodeId(NodeIdType.BYTESTRING,crypto.randomBytes(16));
    this.nodeId = new NodeId(NodeIdType.NUMERIC,sessionId,0);
}

ServerEngine.prototype.createSession = function() {
    var self = this;

    var session = new ServerSession(self._session_counter);

    self._session_counter +=1;

    var key = session.authenticationToken.toString();

    self._sessions[key] = session;

    return session;
};

ServerEngine.prototype.getSession = function(authenticationToken) {

    var self = this;
    if (!authenticationToken || ( authenticationToken.identifierType.value !== NodeIdType.BYTESTRING.value))  {
        return null;     // wrong type !
    }
    var key =authenticationToken.toString();
    return self._sessions[key];
};

var Subscription = require("./subscription").Subscription;

/**
 * create a new subscription
 * @return {Subscription}
 */
ServerEngine.prototype.createSubscription = function (request) {

    assert(request.hasOwnProperty("requestedPublishingInterval")); // Duration
    assert(request.hasOwnProperty("requestedLifetimeCount"));      // Counter
    assert(request.hasOwnProperty("requestedMaxKeepAliveCount"));  // Counter
    assert(request.hasOwnProperty("maxNotificationsPerPublish"));  // Counter
    assert(request.hasOwnProperty("publishingEnabled"));           // Boolean
    assert(request.hasOwnProperty("priority"));                    // Byte

    var self = this;

    var subscription = new Subscription({
        publishingInterval: request.requestedPublishingInterval,
        maxLifeTimeCount:   request.requestedLifetimeCount,
        maxKeepAliveCount:  request.requestedMaxKeepAliveCount,
        maxNotificationsPerPublish: request.maxNotificationsPerPublish,
        publishingEnabled: request.publishingEnabled,
        priority: request.priority
    });

    self._subscription_counter +=1;
    var id = self._subscription_counter;

    subscription.id  = id;

    assert(!this._subscriptions[id]);
    this._subscriptions[id] = subscription;

    this.publishEngine.add_subscription(subscription);
    this.on("publishResponse", function(request,response){
        this.emit("publishResponse",request,response);
    });
    return subscription;
};

/**
 * retrieve the number of active subscriptions
 */
ServerEngine.prototype.__defineGetter__("currentSubscriptionCount",  function() { return Object.keys(this._subscriptions).length; });
ServerEngine.prototype.__defineGetter__("cumulatedSubscriptionCount",function() { return this._subscription_counter; });

/**
 * retrieve an existing subscription by subscriptionId
 * @param subscriptionId {Integer}
 * @return {Subscription}
 */
ServerEngine.prototype.getSubscription = function(subscriptionId) {
    return this._subscriptions[subscriptionId];
};

/**
 *
 * @param subscriptionId
 */
ServerEngine.prototype.deleteSubscription = function(subscriptionId) {

    var subscription = this.getSubscription(subscriptionId);
    if (!subscription) {
        return StatusCodes.Bad_SubscriptionIdInvalid;
    }
    this._subscriptions[subscriptionId] = null;
    delete this._subscriptions[subscriptionId];
    return StatusCodes.Good;
};

ServerEngine.prototype.browsePath = function(browsePath) {
   return this.address_space.browsePath(browsePath);
};

exports.ServerEngine = ServerEngine;

