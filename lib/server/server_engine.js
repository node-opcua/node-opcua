var NodeClass = require("../../lib/browse_service").NodeClass;

var NodeId = require("../../lib/nodeid").NodeId;
var resolveNodeId = require("../../lib/nodeid").resolveNodeId;
var makeNodeId = require("../../lib/nodeid").makeNodeId;
var assert = require('better-assert');
var s = require("../../lib/structures");

var browse_service = require("../../lib/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

var read_service = require("../../lib/read_service");
var AttributeIds = read_service.AttributeIds;
var DataValue = require("../datavalue").DataValue;
var Variant = require("../variant").Variant;
var DataType = require("../variant").DataType;


var util = require("util");

var HasTypeDefinition = resolveNodeId("i=40");

var StatusCodes = require("../../lib/opcua_status_code").StatusCodes;

var coerceQualifyName = s.coerceQualifyName;
var coerceLocalizedText = s.coerceLocalizedText;

var _ = require("underscore");

var address_space = require("../../lib/common/address_space");
var generate_address_space = require("../../lib/common/load_nodeset2").generate_address_space;

var AddressSpace = address_space.AddressSpace;






function make_back_references(address_space) {
    _.forEach(address_space._nodeid_index,function(node) {

        node.propagate_back_references(address_space);
    });
}




/**
 *
 * @param options:
 *      {
 *          nodeset_filename:  <filename> (optional) default : mini.Node.Set2.xml
 *      }
 * @constructor
 */
function ServerEngine(options) {

    options = options || {};

    var default_xmlFile1 = __dirname + "../../../code_gen/Opc.Ua.NodeSet2.xml";
    var default_xmlFile2 = __dirname+"/mini.Node.Set2.xml";
    options.nodeset_filename =  options.nodeset_filename || default_xmlFile2;


    var _the_address_space =  new AddressSpace();
    generate_address_space(_the_address_space,options.nodeset_filename);
    make_back_references(_the_address_space);

    this.address_space = _.clone(_the_address_space);

    this.FolderTypeId = this.findObject("FolderType").nodeId;
    this.BaseDataVariableTypeId = this.findObject("BaseDataVariableType").nodeId;

    this.rootFolder = this.findObject('RootFolder');
    assert(this.rootFolder.readAttribute);

    this._private_namespace = 1;
    this._internal_id_counter = 1000;

}

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

    folder = this.address_space.findObject(folder) || folder;

    assert(folder.hasTypeDefinition.toString() === this.FolderTypeId.toString(), "expecting a Folder here " + folder);
    return folder;
};

/**
 *
 * @param parentFolder
 * @param options
 * @returns {*}
 */
ServerEngine.prototype.createFolder = function (parentFolder, options) {

    // coerce parent folder to an object
    parentFolder = this.getFolder(parentFolder);

    if (typeof options === "string") {
        options = { browseName: options };
    }

    options.nodeId = options.nodeId || this._build_new_NodeId();
    options.nodeClass  = NodeClass.Object;
    options.references = [
        { referenceType: "HasTypeDefinition",isForward:true , nodeId: this.FolderTypeId   },
        { referenceType: "Organizes"        ,isForward:false, nodeId: parentFolder.nodeId }
    ];

    var folder = this.address_space._createObject(options);

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
    return this.address_space.findObject(nodeId);
};

/**
 *
 * @param parentFolder
 * @param options
 * @returns {Variable}
 */
ServerEngine.prototype.addVariableInFolder = function (parentFolder, options) {

    parentFolder = this.getFolder(parentFolder);

    var variableName = options.name;
    var value = options.value;

    var newNodeId = this._build_new_NodeId();

    var options = {
        nodeId: newNodeId,
        nodeClass: NodeClass.Variable,
        browseName: variableName,
        value: value,
        references: [
            { referenceType: "HasTypeDefinition",isForward:true , nodeId: this.BaseDataVariableTypeId   },
            { referenceType: "Organizes"        ,isForward:false, nodeId: parentFolder.nodeId }
        ]
    };
    var variable = this.address_space._createObject(options);

    variable.propagate_back_references(this.address_space);

    return variable;
};


/**
 *
 * @param nodeId
 * @param browseDirection
 * @returns {exports.BrowseResult}
 */
ServerEngine.prototype.browseSingleNode = function (nodeId, browseDescription) {

    browseDescription = browseDescription || {};

    // coerce nodeToBrowse to NodeId
    nodeId = resolveNodeId(nodeId);
    assert(nodeId instanceof NodeId);
    var obj = this.findObject(nodeId);

    var browseResult = {
        statusCode: StatusCodes.Good,
        continuationPoint: null,
        references: null
    };

    var self = this;
    if (!obj) {
        // Object Not Found
        browseResult.statusCode = StatusCodes.Bad_NodeIdExists;
    } else {
        browseResult.statusCode = StatusCodes.Good;
        browseResult.references = obj.browseNode(this,browseDescription);
    }
    return new browse_service.BrowseResult(browseResult);
};

/**
 *
 * @param nodesToBrowse
 * @returns {Array}
 */
ServerEngine.prototype.browse = function (nodesToBrowse) {

    console.log(util.inspect(nodesToBrowse,{ colors:true, depth: 5}));
    var results = [];
    var self = this;
    nodesToBrowse.forEach(function (browseDescription) {
        var nodeId = resolveNodeId(browseDescription.nodeId);
        var r = self.browseSingleNode(nodeId, browseDescription);
        console.log(util.inspect(r,{ colors:true, depth: 5}));
        results.push(r);
    });
    return results;
};

/**
 *
 * @param nodeId
 * @param attributeId
 * @returns {*}
 */
ServerEngine.prototype.readSingleNode = function (nodeId, attributeId) {

    // coerce nodeToBrowse to NodeId
    nodeId = resolveNodeId(nodeId);
    assert(nodeId instanceof NodeId);
    var obj = this.findObject(nodeId);
    if (!obj) {
        // may be return Bad_NodeIdUnknown in dataValue instead ?
        // Object Not Found
        return { statusCode: StatusCodes.Bad_NodeIdUnknown };
    } else {
        // check access
        //    Bad_UserAccessDenied
        //    Bad_NotReadable
        // invalid attributes : Bad_NodeAttributesInvalid
        return obj.readAttribute(attributeId);
    }
};

/**
 *
 * @param nodesToRead
 * @returns {Array|*}
 */
ServerEngine.prototype.read = function (nodesToRead) {

    var self = this;
    var dataValues = nodesToRead.map(function (readValueId) {
        var nodeId = readValueId.nodeId;
        var attributeId = readValueId.attributeId;
        var indexRange = readValueId.indexRange;
        var dataEncoding = readValueId.dataEncoding;
        return self.readSingleNode(nodeId, attributeId);
    });
    return dataValues;
};


exports.ServerEngine = ServerEngine;

