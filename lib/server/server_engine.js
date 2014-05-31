/**
 * @module opcua.server
 */


var NodeClass = require("./../datamodel/nodeclass").NodeClass;

var NodeId = require("../datamodel/nodeid").NodeId;
var resolveNodeId = require("../datamodel/nodeid").resolveNodeId;
var makeNodeId = require("../datamodel/nodeid").makeNodeId;
var NodeIdType = require("../datamodel/nodeid").NodeIdType;

var assert = require('better-assert');
var s = require("../datamodel/structures");

var browse_service = require("../services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

var read_service = require("../services/read_service");
var ReadRequest = read_service.ReadRequest;
var AttributeIds = read_service.AttributeIds;
var TimestampsToReturn = read_service.TimestampsToReturn;

var DataValue = require("../datamodel/datavalue").DataValue;
var Variant = require("../datamodel/variant").Variant;
var DataType = require("../datamodel/variant").DataType;
var VariantArrayType  = require("../datamodel/variant").VariantArrayType;

var BuildInfo = require("../datamodel/buildinfo").BuildInfo;

var util = require("util");
var crypto = require("crypto");

var HasTypeDefinition = resolveNodeId("i=40");

var StatusCodes = require("../datamodel/opcua_status_code").StatusCodes;

var _ = require("underscore");

var address_space = require("../address_space/address_space");
var generate_address_space = require("../address_space/load_nodeset2").generate_address_space;

var AddressSpace = address_space.AddressSpace;
var VariableIds = require("../../lib/opcua_node_ids").VariableIds;

var ReferenceType = require("../address_space/referenceType").ReferenceType;


var EventEmitter = require("events").EventEmitter;
var util = require("util");


/**
 * @class ServerEngine
 * @extends EventEmitter
 * @uses ServerSidePublishEngine
 * @constructor
 */
function ServerEngine() {

    this._private_namespace = 1;
    this._internal_id_counter = 1000;

    this._session_counter = 0;
    this._sessions = {};

    this.startTime = new Date();


    this.status="creating";

    this.buildInfo= new BuildInfo({
        productName:      "NODEOPCUA-SERVER",
        productUri:       "URI:NODEOPCUA-SERVER",
        manufacturerName: "<Manufacturer>",
        softwareVersion:  "1.0",
        buildDate:         new Date()
    });
}

util.inherits(ServerEngine,EventEmitter);

/**
 * @method shutdown
 */
ServerEngine.prototype.shutdown = function() {

    var self = this;

    self.status="shutdown";

    // delete any existing sessions
    var tokens = Object.keys(self._sessions).map(function(key){
        var session = self._sessions[key];
        return session.authenticationToken;
    });
    tokens.forEach(function(token){ self.closeSession(token,true); });

    // all sessions must have been terminated
    assert(self.currentSessionCount === 0);
};

/**
 * @property currentSessionCount
 * @type {Number}
 */
ServerEngine.prototype.__defineGetter__("currentSessionCount",  function() { return Object.keys(this._sessions).length; });

/**
 * @property cumulatedSessionCount
 * @type {Number}
 */
ServerEngine.prototype.__defineGetter__("cumulatedSessionCount",function() { return this._session_counter; });

/**
 * @method initialize
 * @async
 *
 * @param options {Object}
 * @param options.nodeset_filename {String} - [option](default : mini.Node.Set2.xml)
 * @param callback
 */
ServerEngine.prototype.initialize = function(options,callback) {

    var self = this;
    assert(!self.address_space); // check that 'initalize' has not been already called
    self.status="initializing";
    options = options || {};
    assert(_.isFunction(callback));

    //var default_xmlFile1 = __dirname + "../../../code_gen/Opc.Ua.NodeSet2.xml";

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

            assert(_.isFunction(func));
            assert(dataType !=null); // check invalid dataType

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
            DataType.UInt32,function() {return self.currentSubscriptionCount; });

        bindStandardScalar(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CumulatedSessionCount,
            DataType.UInt32,function() {return self.cumulatedSubscriptionCount; });

        bindStandardScalar(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount,
            DataType.UInt32,function() {return self.currentSessionCount; });

        bindStandardScalar(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CumulatedSessionCount,
            DataType.UInt32,function() {return self.cumulatedSessionCount; });

        // ServerDiagnostics.ServerDiagnosticsSummary.CurrentSubscriptionCount

        bindStandardScalar(VariableIds.Server_ServerStatus_BuildInfo_ProductName,
            DataType.String,function() { return self.buildInfo.productName; });

        bindStandardScalar(VariableIds.Server_ServerStatus_BuildInfo_ProductUri,
            DataType.String,function() { return self.buildInfo.productUri;});

        bindStandardScalar(VariableIds.Server_ServerStatus_BuildInfo_ManufacturerName,
            DataType.String,function() { return self.buildInfo.manufacturerName ; });

        bindStandardScalar(VariableIds.Server_ServerStatus_BuildInfo_SoftwareVersion,
            DataType.String,function() { return self.buildInfo.softwareVersion; });

        bindStandardScalar(VariableIds.Server_ServerStatus_BuildInfo_BuildNumber,
             DataType.String,function() { return self.buildInfo.buildNumber;});

        bindStandardScalar(VariableIds.Server_ServerStatus_BuildInfo_BuildDate,
            DataType.DateTime,function() { return self.buildInfo.buildDate; });

        self.status="initialized";
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
    var nodeId = makeNodeId(this._internal_id_counter, this._private_namespace);
    this._internal_id_counter += 1;
    return nodeId;
};

/**
 *
 * @method getFolder
 * @param folder
 * @return {UAObject hasTypeDefinition: FolderType }
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
 * @method createFolder
 * @param parentFolder
 * @param options
 * @return {BaseNode}
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
 * @method findObject
 * @param nodeId
 * @return {BaseNode}
 */
ServerEngine.prototype.findObject = function(nodeId) {
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
ServerEngine.prototype.findObjectByBrowseName = function(browseName) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called
    return self.address_space.findObjectByBrowseName(browseName);
};

/**
 *
 * @method addVariableInFolder
 * @param parentFolder
 * @param options
 *        {
 *           browseName: "<some name>" //  [Mandatory] Variable Browse Name
 *           nodeId: some_name || null // [optional]
 *           value:  {
 *              get : function() {
  *                return Variant({...});
  *             },
 *              set : function(variant) {
 *                // store
 *                return StatsCodes.Good;
 *              }
 *           }
 *           description: "<some text>" // [optional]
 *        }
 * @return {Variable}
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

ServerEngine.prototype.__findObject = function(nodeId) {
    // coerce nodeToBrowse to NodeId
    nodeId = resolveNodeId(nodeId);
    assert(nodeId instanceof NodeId);
    var obj = this.findObject(nodeId);
    return obj;
};

/**
 *
 * @method browseSingleNode
 * @param nodeId
 * @param browseDescription
 * @return {exports.BrowseResult}
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

    var obj = this.__findObject(nodeId);


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
 * @method browse
 * @param nodesToBrowse {BrowseDescription[]}
 * @return {BrowseResult[]}
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
 * @method readSingleNode
 * @param nodeId
 * @param attributeId
 * @param [timestampsToReturn=TimestampsToReturn.Neither]
 * @return {DataValue}
 */
ServerEngine.prototype.readSingleNode = function (nodeId, attributeId ,timestampsToReturn) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called

    timestampsToReturn = (timestampsToReturn !== null) ?timestampsToReturn : TimestampsToReturn.Neither;

    var obj = this.__findObject(nodeId);

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
 * @method read
 * @param readRequest {ReadRequest}
 * @return {DataValue[]}
 */
ServerEngine.prototype.read = function (readRequest) {

    assert(readRequest instanceof ReadRequest);
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
 * @method writeSingleNode
 * @param writeValue {Object}
 * @return {StatusCodes}
 */
ServerEngine.prototype.writeSingleNode = function (writeValue) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called

    var nodeId = writeValue.nodeId;

    var obj = this.__findObject(nodeId);
    if (!obj) {
        return StatusCodes.Bad_NodeIdUnknown;
    } else {
        return obj.write(writeValue);
    }
};

/**
 *
 * @method writeSingleNode
 * @param nodesToWrite {Object[]}
 * @return {StatusCode[]}
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
 * @method bindVariable
 * @param nodeId {NodeId}
 * @param options
 */
ServerEngine.prototype.bindVariable = function( nodeId, options ){
    options = options || {};

    assert(_.difference(["get","set"], _.keys(options)).length === 0);

    var obj = this.findObject(nodeId);
    if(obj && obj.bindVariable)  {
        obj.bindVariable(options);
    } else {
        console.log(" cannot bind object with id ",nodeId.toString()," please check your nodeset.xml file or add this node programatically");
    }
};


var ServerSession = require("./server_session").ServerSession;


/**
 * create a new server session object.
 * @class ServerEngine
 * @method createSession
 * @return {ServerSession}
 */
ServerEngine.prototype.createSession = function() {

    var self = this;

    var session = new ServerSession(self._session_counter);

    self._session_counter +=1;

    var key = session.authenticationToken.toString();

    self._sessions[key] = session;

    return session;
};

/**
 * @method closeSession
 * @param authenticationToken
 * @param {Boolean} deleteSubscriptions : true if sessions's sbuscription shall be deleted
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
ServerEngine.prototype.closeSession = function(authenticationToken,deleteSubscriptions) {
    var self = this;
    assert(authenticationToken && ( authenticationToken.identifierType.value === NodeIdType.BYTESTRING.value));
    var key =authenticationToken.toString();

    var session = self._sessions[key];

    session.close(deleteSubscriptions);

    delete self._sessions[key];

};

/**
 * retrieve a session by its authenticationToken.
 *
 * @method getSession
 * @param authenticationToken
 * @return {ServerSession}
 */
ServerEngine.prototype.getSession = function(authenticationToken) {

    var self = this;
    if (!authenticationToken || ( authenticationToken.identifierType.value !== NodeIdType.BYTESTRING.value))  {
        return null;     // wrong type !
    }
    var key =authenticationToken.toString();
    return self._sessions[key];
};



/**
 * @method browsePath
 * @param browsePath
 * @return {BrowsePathResult}
 */
ServerEngine.prototype.browsePath = function(browsePath) {
   return this.address_space.browsePath(browsePath);
};

exports.ServerEngine = ServerEngine;

