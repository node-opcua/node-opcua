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


var address_space = require("../../lib/common/address_space");

var BaseNode = address_space.BaseNode;

var ReferenceType = address_space.ReferenceType;
var ObjectType    = address_space.ObjectType;
var VariableType    = address_space.VariableType;

var Folder   = address_space.Folder;
var Variable = address_space.Variable;
var AddressSpace = address_space.AddressSpace;


function ServerEngine() {

    this.address_space = new AddressSpace();

    this.rootFolder = new Folder({ nodeId: "RootFolder", browseName: "Root" });
    this.address_space._register(this.rootFolder);
    assert(this.rootFolder.readAttribute);

    this._private_namespace = 1;
    this._internal_id_counter = 1000;

    this._add_objects_folder();
}

ServerEngine.prototype._build_new_NodeId = function () {
    var nodeId = makeNodeId(this._internal_id_counter, this._private_namespace);
    this._internal_id_counter += 1;
    return nodeId;
};

ServerEngine.prototype.getFolder = function (folder) {
    // coerce rootFolder
    if (!(folder instanceof Folder)) {
        folder = this.address_space.findObject(folder) || folder;
    }
    assert(folder instanceof Folder, "expecting a Folder here " + folder);
    return folder;
};

ServerEngine.prototype.createFolder = function (parentFolder, options) {

    // coerce parent folder to an object
    parentFolder = this.getFolder(parentFolder);

    if (typeof options === "string") {
        options = { browseName: options };
    }

    options.nodeId = options.nodeId || this._build_new_NodeId();
    options.hasTypeDefinition = "FolderType";
    options.back_references = [
        { referenceTypeId: this.address_space._resolveNodeId("Organizes"), nodeId: parentFolder.nodeId }
    ];

    var folder = this.address_space._createObject(options);
    folder.parent = parentFolder;
    return folder;
};

ServerEngine.prototype.findObject = function(nodeId) {
    return this.address_space.findObject(nodeId);
};

ServerEngine.prototype._add_objects_folder = function () {

    var options = {
        nodeId: "i=85",
        browseName: "Objects",
        symbolicName: "ObjectsFolder",
        displayName: "Objects",
        description: "The browse entry point when looking for objects in the server address space."
    };
    return this.createFolder(this.rootFolder, options);
};



ServerEngine.prototype.addVariableInFolder = function (parentFolder, options) {

    parentFolder = this.getFolder(parentFolder);

    var variableName = options.name;
    var value = options.value;

    var newNodeId = this._build_new_NodeId();
    var variable = new Variable({ nodeId: newNodeId, browseName: variableName, value: value });
    this.address_space._register(variable);

    parentFolder.elements.push(variable);

    variable.parent = parentFolder;
    return variable;
};



ServerEngine.prototype.browseSingleNode = function (nodeId, browseDirection) {

    browseDirection = browseDirection || BrowseDirection.Both;

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
        browseResult.references = obj.browseNode(this,{
            browseDirection: browseDirection
        });
    }
    return new browse_service.BrowseResult(browseResult);
};

ServerEngine.prototype.browse = function (nodesToBrowse) {

    var results = [];
    var self = this;
    nodesToBrowse.forEach(function (browseDescription) {
        var nodeId = browseDescription.nodeId;
        var browseDirection = browseDescription.browseDirection;
        var r = self.browseSingleNode(nodeId, browseDirection);
        results.push(r);
    });
    //xx return new browse_service.BrowseResponse({
    //xx    results: results
    //xx});
    return results;
};


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
exports.Variable = Variable;
exports.Folder = Folder;

