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
var BrowseResult = browse_service.BrowseResult;


var read_service = require("../services/read_service");
var ReadRequest = read_service.ReadRequest;
var AttributeIds = read_service.AttributeIds;
var TimestampsToReturn = read_service.TimestampsToReturn;

var DataValue = require("../datamodel/datavalue").DataValue;
var Variant = require("../datamodel/variant").Variant;
var DataType = require("../datamodel/variant").DataType;
var VariantArrayType  = require("../datamodel/variant").VariantArrayType;
var isValidVariant = require("../datamodel/variant").isValidVariant;

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
var BaseNode = require("../address_space/basenode").BaseNode;



var EventEmitter = require("events").EventEmitter;
var util = require("util");


/**
 * @class ServerEngine
 * @extends EventEmitter
 * @uses ServerSidePublishEngine
 * @constructor
 */
function ServerEngine() {

    EventEmitter.apply(this,arguments);

    this._private_namespace = 1;
    this._internal_id_counter = 1000;

    this._session_counter = 0;
    this._sessions = {};

    this.startTime = new Date();

    this.status="creating";

    this.address_space = null;

    this.buildInfo= new BuildInfo({
        productName:      "NODEOPCUA-SERVER",
        productUri:       "URI:NODEOPCUA-SERVER",
        manufacturerName: "<Manufacturer>",
        softwareVersion:  "1.0",
        buildDate:         new Date()
    });

    this._cumulatedSubscriptionCount = 0;
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
 * @property currentSubscriptionCount
 * @type {Number}
 */
ServerEngine.prototype.__defineGetter__("currentSubscriptionCount",  function() {
    // currentSubscriptionCount returns the total number of subscriptions
    // that are currently active on all sessions
    var counter =0;
    _.values(this._sessions).forEach(function(session){
        counter += session.currentSubscriptionCount;
    });
    return counter;
});

/**
 * @property currentSessionCount
 * @type {Number}
 */
ServerEngine.prototype.__defineGetter__("cumulatedSubscriptionCount",  function() {
    // TODO: fix this question:
    //  shall we return the cumulatedSubscriptionCount of the calling session or
    //  the total of subscription count that have been ever created by all sessions ?
    return this._cumulatedSubscriptionCount;
});

var nodeset = require("../address_space/convert_nodeset_to_types").nodeset;
var makeServerStatus = require("../address_space/convert_nodeset_to_types").makeServerStatus;

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

    //xx console.log(" options.nodeset_filename ",options.nodeset_filename );

    generate_address_space(self.address_space, options.nodeset_filename,function(){

        makeServerStatus(self.address_space);


        self.FolderTypeId = self.findObject("FolderType").nodeId;
        self.BaseObjectTypeId = self.findObject("BaseObjectType").nodeId;
        self.BaseDataVariableTypeId = self.findObject("BaseDataVariableType").nodeId;
        //xx self.ObjectType = self.findObject("ObjectType").nodeId;


        self.rootFolder = self.findObject('RootFolder');
        assert(self.rootFolder.readAttribute);


        self.serverState = nodeset.ServerState.Running;

        self.bindVariable(makeNodeId(VariableIds.Server_ServerStatus), {

            get : function() {
                var serverStatus = new nodeset.ServerStatus({
                    "startTime"            :  self.startTime,
                    "currentTime"          :  new Date(),
                    "state"                :  self.serverState,
                    "buildInfo"            :  self.buildInfo,
                    "secondsTillShutdown"  :  10,
                    "shutdownReason"       :  { text: "<some reason>"   }
                });
                return new Variant({
                    dataType: DataType.ExtensionObject,
                    value: serverStatus
                });
            },
            set: null
        });

        self.bindVariable(makeNodeId(VariableIds.Server_ServerStatus_BuildInfo), {
            get : function() {
                return new Variant({
                    dataType: DataType.ExtensionObject,
                    value: self.buildInfo
                });
            },
            set: null
        });

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
            dataType:  "String",
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



        var ServerStateDataTypeId = self.address_space.findDataType("ServerState").nodeId;

        var server_ServerStatus_State = makeNodeId(VariableIds.Server_ServerStatus_State); // ns=0;i=2259
        self.bindVariable(server_ServerStatus_State,{
            dataType: self.address_space.findDataType("ServerState").nodeId,
            get: function(){
                return new Variant({
                    dataType: DataType.UInt32,
                    value:    self.serverState
                });
            },
            set: null // read only
        });

        function bindStandardScalar(id,dataType,func) {

            assert(_.isFunction(func));
            assert(dataType !== null); // check invalid dataType

            var nodeId = makeNodeId(id);

            // make sur the provided function returns a valid value for the variant type
            // This test may not be exhaustive but it will detect obvious mistake.
            assert(isValidVariant(dataType,func()));

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

        bindStandardScalar(VariableIds.Server_ServiceLevel,
            DataType.Byte,function() { return 255; });

        bindStandardScalar(VariableIds.Server_Auditing,
            DataType.Boolean,function() { return false; });

        bindStandardScalar(VariableIds.Server_ServerStatus_StartTime,
            DataType.DateTime,function() { return self.startTime; });

        bindStandardScalar(VariableIds.Server_ServerStatus_CurrentTime,
            DataType.DateTime,function() { return new Date(); });

        bindStandardScalar(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSubscriptionCount,
            DataType.UInt32, function() {return self.currentSubscriptionCount; });

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
    var nodeId = makeNodeId(this._internal_id_counter, this._private_namespace);
    this._internal_id_counter += 1;
    return nodeId;
};

/**
 *
 * @method getFolder
 * @param folder   {Object|String|NodeId} the folder identifier either as an object, a nodeid string, or a NodeId.
 * @return {UAObject hasTypeDefinition: FolderType }
 */
ServerEngine.prototype.getFolder = function(folder) {
    var self = this;

    if (folder instanceof BaseNode) {
        // already a folder (?)
        // TODO make sure the folder exists in the address space and that the folder object is a Folder
        return folder;
    }

    assert(self.address_space instanceof AddressSpace); // initialize not called

    folder = self.address_space.findObjectByBrowseName(folder) || folder;
    if(!folder || !folder.hasTypeDefinition) {
        folder = self.address_space.findObject(folder) || folder;
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
 * @param options {String|Object}
 * @param options.browseName {String}
 * @param [options.nodeId] {NodeId}
 *
 * @return {BaseNode}
 */
ServerEngine.prototype.createFolder = function (parentFolder, options) {
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called

    if ( typeof parentFolder === "string" ) {
        // coerce parent folder to an object
        parentFolder = self.getFolder(parentFolder);
    }

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


var Variable = require("../address_space/variable").Variable;
/**
 * add a new variable inside an object
 * @method addVariable
 * @param parentObject {Object|Folder}  : the parent Object
 * @param options
 * @param options.browseName  {String}   : the variable browse name
 * @param [options.nodeId]    {NodeId}   : the variable nodeid. If not specified a new nodeId will be generated
 * @param [options.nodeId]    {String||NodeId}   : the variable nodeid. If not specified a new nodeId will be generated
 * @param [options.historizing] {Boolean}   : default value : false
 * @param [options.minimumSamplingInterval] [UInt32] : default value: 10 ms
 * @param options.value.get     {Function} : the variable getter function
 * @param [options.value.set]   {Function} : the variable setter function
 * @param options.browseName    {String}   : the variable browse name
 * @returns {Variable}
 *
 */
ServerEngine.prototype.addVariable = function(parentObject,options) {

    var self = this;

    assert(options.hasOwnProperty("browseName"));
    assert(options.hasOwnProperty("dataType"));
    assert(self.FolderTypeId  &&  self.BaseObjectTypeId ); // is default address space generated.?
    assert(parentObject instanceof BaseNode);

    if (typeof options.dataType === "string") {
        // resolve datatype
        //XX console.log( "XXXX resolving " ,options.dataType);
        var n = self.address_space._aliases[options.dataType];
        if (n) {
            options.dataType = n;
        } else {
            var dataType =  self.address_space._dataTypeMap[options.dataType];
            if (!dataType) {
                throw Error( "addVariable  : dataType "+ options.dataType+ " does'nt exist in address space");
            }
            n =dataType.nodeId;
            options.dataType = n;
        }
        assert(options.dataType instanceof NodeId);
    }

    var browseName = options.browseName;

    var newNodeId = options.nodeId || this._build_new_NodeId();

    var variable = self.address_space._createObject({
        nodeId:     newNodeId,
        nodeClass:  NodeClass.Variable,
        dataType:   options.dataType,
        browseName:   browseName,
        historizing: options.historizing || false,
        minimumSamplingInterval: options.minimumSamplingInterval || 10,
        //xx value: value,
        references: [
            { referenceType: "HasTypeDefinition", isForward: true,  nodeId: self.BaseDataVariableTypeId   },
            { referenceType: "HasProperty",       isForward: false, nodeId: parentObject.nodeId }
        ]
    });
    assert(variable instanceof Variable );

    variable.propagate_back_references(this.address_space);

    variable.bindVariable(options.value);
    return variable;
};

/**
 *
 * @method addVariableInFolder
 * @param parentFolder {String} the name of the parent folder
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
 *
 */
ServerEngine.prototype.addVariableInFolder = function (parentFolder, options) {
    var self = this;
    parentFolder = this.getFolder(parentFolder);
    assert(parentFolder); // parent folder must exist
    assert(parentFolder instanceof BaseNode); // parent folder must exist
    return self.addVariable(parentFolder,options);
};




ServerEngine.prototype.addObjectInFolder = function (parentObject,options) {

    parentObject = this.getFolder(parentObject);
    var self = this;
    assert(self.address_space instanceof AddressSpace);
    assert(options.hasOwnProperty("browseName")&& options.browseName.length>0);
    assert(parentObject && parentObject.nodeId); // should have a valid parent folder
    //xx assert(parentFolder instanceof BaseNode); // parent folder must exist

    var obj = self.address_space._createObject({
        nodeClass: NodeClass.Object,
        isAbstract: false,
        nodeId: options.nodeId ||null,
        browseName: options.browseName,
        description: options.description || "",
        eventNotifier: options.eventNotifier,
        references: [
            { referenceType: "HasTypeDefinition", isForward: true, nodeId: self.BaseObjectTypeId   },
            { referenceType: "ComponentOf", isForward: true, nodeId: parentObject.nodeId }
        ]
    });
    assert(obj.nodeId !== null);

    obj.propagate_back_references(self.address_space);

    return obj;
};


ServerEngine.prototype.__findObject = function(nodeId) {
    // coerce nodeToBrowse to NodeId
    try {
        nodeId = resolveNodeId(nodeId);
    }
    catch(err) {
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
    browseDescription.browseDirection = browseDescription.browseDirection || BrowseDirection.Forward ;


    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called
    assert(browseDescription.browseDirection);

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
                return new BrowseResult(browseResult);
            }
        }
    }

    if (!obj) {
        // Object Not Found
        browseResult.statusCode = StatusCodes.Bad_NodeIdUnknown;
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
 * @param attributeId {AttributeId}
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

        //xx console.log("XXXX nodeID",nodeId.toString(),"attributeId",attributeId);
        //xx console.log(dataValue.toString());

        assert(dataValue.isValid());

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

    assert(dataValues.length === readRequest.nodesToRead.length);
    return dataValues;
};

/**
 *
 * @method writeSingleNode
 * @param writeValue {DataValue}
 * @return {StatusCodes}
 */
ServerEngine.prototype.writeSingleNode = function (writeValue) {

    assert(writeValue._schema.name === "WriteValue");
    assert(writeValue.value instanceof DataValue);
    assert(writeValue.value.value instanceof Variant);
    var self = this;
    assert(self.address_space instanceof AddressSpace); // initialize not called

    var nodeId = writeValue.nodeId;

    var obj = this.__findObject(nodeId);
    if (!obj) {
        return StatusCodes.Bad_NodeIdUnknown;
    } else {
        return obj.writeAttribute(writeValue.attributeId,writeValue.value);
    }
};


var WriteValue = require("../services/write_service").WriteValue;
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
        assert(writeValue instanceof WriteValue);
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

    // must have a get and a set property
    assert(_.difference(["get","set"], _.keys(options)).length === 0);

    var obj = this.findObject(nodeId);
    if(obj && obj.bindVariable)  {
        obj.bindVariable(options);
    } else {
        console.log(" cannot bind object with id ",nodeId.toString()," please check your nodeset.xml file or add this node programmatically");
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

    session.on("new_subscription",function(){
        self._cumulatedSubscriptionCount +=1;
    })
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

