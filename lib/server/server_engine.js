
var NodeClass = require("../../lib/browse_service").NodeClass;

var NodeId = require("../../lib/nodeid").NodeId;
var resolveNodeId = require("../../lib/nodeid").resolveNodeId;
var makeNodeId = require("../../lib/nodeid").makeNodeId;
var assert = require("assert");
var s = require("../../lib/structures");
var browse_service = require("../../lib/browse_service");
var util = require("util");

var HasTypeDefinition = resolveNodeId("i=40");



function BaseClass() {

}

function BaseObject() {

    BaseClass.apply(this,arguments);
    this.references = [];
    this.back_references = [];
}
util.inherits(BaseObject, BaseClass);

BaseObject.prototype._add_forward_reference = function(referenceTypeId,nodeId) {

    this.references.push({
        referenceTypeId:referenceTypeId,
        nodeId: nodeId
    });
};

BaseObject.prototype._add_backward_reference = function(referenceTypeId,nodeId) {

    this.back_references.push({
        referenceTypeId:referenceTypeId,
        nodeId: nodeId
    });

};

BaseObject.prototype.nodeClass = NodeClass.Object;
BaseObject.typeDefinition = resolveNodeId("BaseObjectType");

function Folder(options) {

    assert(options);
    assert(options.nodeId);
    assert(options.browseName);

    BaseObject.apply(this,arguments);

    assert(this.typeDefinition.value === 61);

    this.nodeId = resolveNodeId(options.nodeId);

    this.browseName = options.browseName;

    options.displayName = options.displayName || options.browseName; // xx { locale: "en", text: options.browseName };

    this.displayName = [];
    if (typeof options.displayName === "string") {
        this.displayName.push(new s.LocalizedText({ locale: "en", text: options.displayName }));
    }

    this.elements = [];
}
util.inherits(Folder, BaseObject);
Folder.prototype.typeDefinition = resolveNodeId("FolderType");

function Variable(options) {

    assert(options);
    assert(options.nodeId);
    assert(options.browseName);
    assert(this.typeDefinition.value == resolveNodeId("VariableType").value);

    BaseObject.apply(this,arguments);

    this.nodeId = resolveNodeId(options.nodeId);

    this.displayName = [];
    this.displayName.push(new s.LocalizedText({ locale: "en", text: options.displayName }));

    this.browseName = options.browseName;

    this.value = options.value;
}
util.inherits(Variable, BaseObject);
Variable.prototype.typeDefinition = resolveNodeId("VariableType");


function ServerEngine() {

    this._nodeid_index = {};
    this._browsename_index = {};
    this.rootFolder = new Folder({ nodeId: "RootFolder", browseName: "Root" });
    this._private_namespace = 1;
    this._internal_id_counter = 1000;

    this._register(this.rootFolder);
    this._add_objects_folder();
}


ServerEngine.prototype._register = function (object) {

    assert(object.nodeId);
    assert(!this._nodeid_index.hasOwnProperty(object.nodeId.toString())," nodeid already registered");
    this._nodeid_index[object.nodeId.toString()] = object;
    this._browsename_index[object.browseName] = object.nodeId;
};
ServerEngine.prototype._resolveNodeId = function (nodeid) {

    if (typeof nodeid === "string") {
        // check if the string is a known browse Name
        if (this._browsename_index.hasOwnProperty(nodeid)) {
            return this._browsename_index[nodeid];
        }
    }
    return resolveNodeId(nodeid);
};

ServerEngine.prototype.findObject = function (nodeId) {
    nodeId = this._resolveNodeId(nodeId);
    return this._nodeid_index[nodeId.toString()];
};

ServerEngine.prototype._build_new_NodeId = function () {
    var nodeId = makeNodeId(this._internal_id_counter, this._private_namespace);
    this._internal_id_counter += 1;
    return nodeId;
};

ServerEngine.prototype.getFolder = function (folder) {
    // coerce rootFolder
    if (!(folder instanceof Folder)) {
        folder = this.findObject(folder) || folder;
    }
    assert(folder instanceof Folder, "expecting a Folder here " + folder);
    return folder;
};


ServerEngine.prototype.createFolder = function (parentFolder, options) {

    // coerce parent folder to an object
    parentFolder = this.getFolder(parentFolder);

    if (typeof options === "string" ) {
        options = { browseName: options };
    }

    options.nodeId            = options.nodeId || this._build_new_NodeId();
    options.hasTypeDefinition = "FolderType";
    options.back_references=  [{ referenceTypeId: this._resolveNodeId("Organizes"),  nodeId: parentFolder.nodeId }];

    var folder =this._createObject(options);
    folder.parent = parentFolder;
    return folder;
};

ServerEngine.prototype._add_objects_folder = function () {

    var options = {
        nodeId: "i=85",
        browseName: "Objects",
        symbolicName: "ObjectsFolder",
        displayName: "Objects",
        description: "The browse entry point when looking for objects in the server address space.",
    };
    return this.createFolder(this.rootFolder,options);

};

ServerEngine.prototype._createObject = function (options) {


    assert(options.hasTypeDefinition, "must have options.hasTypeDefinition");
    var typeDefinitionId = this._resolveNodeId(options.hasTypeDefinition);
    assert(typeDefinitionId.toString() === "ns=0;i=61"); // FolderType

    var object = new Folder({
        nodeId: options.nodeId,
        browseName: options.browseName,
        symbolicName: options.symbolicName || options.browseName,
        displayName: options.displayName || options.browseName,
        description: options.description,
        back_references: options.back_references,
        references: options.references
    });


    this._register(object);
    var self = this;

    if (options.references) {
        options.references.forEach(function(reference){
            var nodeId = reference.nodeId;
            var parent = self.findObject(nodeId);
            object._add_forward_reference(reference.referenceTypeId,parent.nodeId);
            parent._add_backward_reference(reference.referenceTypeId,object.nodeId);
        });
    }
    if (options.back_references) {
        options.back_references.forEach(function(reference){
            var nodeId = reference.nodeId;
            var parent = self.findObject(nodeId);
            object._add_backward_reference(reference.referenceTypeId,parent.nodeId);
            parent._add_forward_reference(reference.referenceTypeId,object.nodeId);
        });

    }

    assert(object.nodeId instanceof NodeId);
    return object;
};



ServerEngine.prototype.addVariableInFolder = function (parentFolder, options) {

    parentFolder = this.getFolder(parentFolder);

    var variableName = options.name;
    var value = options.value;

    var newNodeId = this._build_new_NodeId();
    var variable = new Variable({ nodeId: newNodeId, browseName: variableName, value: value });
    this._register(variable);

    parentFolder.elements.push(variable);

    variable.parent = parentFolder;
    return variable;
};
function makeStatusCode(statusCode, severity) {
    return 0x80000000 + statusCode;
}
var StatusCodes = require("../../lib/opcua_status_code").StatusCodes;


function coerceQualifyName(value) {

    if (typeof value === "string") {
        return { namespaceIndex: 0, name: value};
    }
    assert(value.hasOwnProperty("namespaceIndex"));
    assert(value.hasOwnProperty("name"));
    return a;
}
function coerceLocalizedText(a) {
    return a;
}
ServerEngine.prototype._makeReferenceDescription = function(reference, isForward) {

    var referenceTypeId= reference.referenceTypeId;
    var obj = this.findObject(reference.nodeId);

    var data = {
        referenceTypeId:   referenceTypeId,
        isForward:         isForward,
        nodeId:            obj.nodeId,
        browseName:        coerceQualifyName(obj.browseName),
        displayName:       coerceLocalizedText(obj.displayName),
        nodeClass:         obj.nodeClass,
        typeDefinition:    obj.typeDefinition
    };

    return new browse_service.ReferenceDescription(data)
}
ServerEngine.prototype.browseSync = function (nodeToBrowse) {

    // coerce nodeToBrowse to NodeId
    nodeToBrowse = resolveNodeId(nodeToBrowse);

    assert(nodeToBrowse instanceof NodeId);
    var obj = this.findObject(nodeToBrowse);

    var browseResult = {
        statusCode: 0,
        continuationPoint: null,
        references: null
    };

    var self = this;
    if (!obj) {
        // Object Not Found
        browseResult.statusCode = makeStatusCode(StatusCodes.Bad_NodeIdExists);
    } else {
        var f = obj.references.map(function(reference){return self._makeReferenceDescription(reference,true); });
        var b = obj.back_references.map(function(reference){return self._makeReferenceDescription(reference,false); });
        browseResult.references = f.concat(b);

    }
    return new browse_service.BrowseResult(browseResult);
};

exports.ServerEngine = ServerEngine;
exports.Variable = Variable;
exports.Folder = Folder;

