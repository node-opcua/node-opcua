var NodeClass = require("../../lib/browse_service").NodeClass;

var NodeId = require("../../lib/nodeid").NodeId;
var resolveNodeId = require("../../lib/nodeid").resolveNodeId;
var makeNodeId = require("../../lib/nodeid").makeNodeId;
var assert = require('better-assert');
var s = require("../../lib/structures");
var browse_service = require("../../lib/browse_service");

var read_service = require("../../lib/read_service");
var DataValue = require("../datavalue").DataValue;
var Variant = require("../variant").Variant;
var DataType = require("../variant").DataType;
var AttributeIds = read_service.AttributeIds;

var BrowseDirection = browse_service.BrowseDirection;
var util = require("util");

var HasTypeDefinition = resolveNodeId("i=40");

var StatusCodes = require("../../lib/opcua_status_code").StatusCodes;

function coerceQualifyName(value) {

    if (!value) {
        return null;
    }
    if (typeof value === "string") {
        return { namespaceIndex: 0, name: value};
    }
    assert(value.hasOwnProperty("namespaceIndex"));
    assert(value.hasOwnProperty("name"));
    return value;
}

function coerceLocalizedText(value) {
    if (typeof value === "string") {
        return { locale: null, text: value};
    };
    console.log("value " , value);
    assert(value.hasOwnProperty("locale"));
    assert(value.hasOwnProperty("text"));
    return value;
}

/**
 * BaseNode is the base class for all the OPCUA objects in the address space
 * It provides attributes and a set of references to other nodes.
 *
 * @param options
 * @constructor
 */
function BaseNode(options) {

    this.nodeId = resolveNodeId(options.nodeId);

    this.browseName = options.browseName;

    options.displayName = options.displayName || options.browseName; // xx { locale: "en", text: options.browseName };

    this.displayName = [];
    if (typeof options.displayName === "string") {
        this.displayName.push(new s.LocalizedText({ locale: null, text: options.displayName }));
    }
    this.references = [];
    this.back_references = [];
}

BaseNode.prototype._add_forward_reference = function (referenceTypeId, nodeId) {

    this.references.push({
        referenceTypeId: referenceTypeId,
        nodeId: nodeId
    });
};

BaseNode.prototype._add_backward_reference = function (referenceTypeId, nodeId) {
    this.back_references.push({
        referenceTypeId: referenceTypeId,
        nodeId: nodeId
    });
};

BaseNode.prototype.readAttribute = function (attributeId) {

    var options = {};
    options.statusCode = StatusCodes.Good;
    switch (attributeId) {
        case AttributeIds.NodeId:  // NodeId
            options.value = { dataType: DataType.NodeId, value: this.nodeId };
            break;
        case AttributeIds.NodeClass: // NodeClass
            assert(isFinite(this.nodeClass.value));
            options.value = { dataType: DataType.UInt32, value: this.nodeClass.value };
            break;
        case AttributeIds.BrowseName: // QualifiedName
            // QualifiedName
            options.value = { dataType: DataType.QualifiedName, value: { name: this.browseName, namespaceIndex: 0 } };
            break;
        case AttributeIds.DisplayName: // LocalizedText
            options.value = { dataType: DataType.LocalizedText, value: this.displayName[0] };
            break;
        case AttributeIds.Description: // LocalizedText
            options.value = { dataType: DataType.LocalizedText, value: { locale: null , text: ""} };
            break;

        case AttributeIds.WriteMask:
            console.log(" warning WriteMask not implemented " + this.nodeId.toString());
            options.value = { dataType: DataType.UInt32, value: 0 };
            break;

        case AttributeIds.UserWriteMask:
            console.log(" warning UserWriteMask not implemented " + this.nodeId.toString());
            options.value = { dataType: DataType.UInt32, value: 0 };
            break;
        default:
            options.statusCode = StatusCodes.Bad_AttributeIdInvalid;
            break;
    }
    return new DataValue(options);
};


/**
 *
 * @param options
 * @constructor
 */
function ReferenceType(options) {
    BaseNode.apply(this, arguments);
    this.isAbstract = (options.isAbstract === null) ? false : options.isAbstract;
    this.symmetric = (options.symmetric === null) ? false : options.symmetric;
    this.inverseName = coerceLocalizedText(options.inverseName);
}
util.inherits(ReferenceType, BaseNode);
ReferenceType.prototype.nodeClass = NodeClass.ReferenceType;

ReferenceType.prototype.readAttribute = function (attributeId) {

    var options = {};
    switch (attributeId) {
        case AttributeIds.IsAbstract:
            options.value = { dataType: DataType.Boolean, value: this.isAbstract ? true : false };
            break;
        case AttributeIds.Symmetric:
            options.value = { dataType: DataType.Boolean, value: this.symmetric ? true : false };
            break;
        case AttributeIds.InverseName: // LocalizedText
            options.value = { dataType: DataType.LocalizedText, value: this.inverseName  };
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this,attributeId);
    }
    return new DataValue(options);
};

/**
 *
 * @param options
 * @constructor
 */
function ObjectType(options) {
    BaseNode.apply(this, arguments);
    //
    this.isAbstract = (options.isAbstract === null) ? false : options.isAbstract;
}
util.inherits(ObjectType, BaseNode);
ObjectType.prototype.nodeClass = NodeClass.ObjectType;

ObjectType.prototype.readAttribute = function (attributeId) {
    var options = {};
    switch (attributeId) {
        case AttributeIds.IsAbstract:
            options.value = { dataType: DataType.Boolean, value: this.isAbstract ? true : false };
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this,attributeId);
    }
    return new DataValue(options);
};

/**
 *
 * @param options
 * @constructor
 */
function BaseObject(options) {
    BaseNode.apply(this, arguments);
    this.eventNotifier = options.eventNotifier || 0;
}

util.inherits(BaseObject, BaseNode);
BaseObject.prototype.nodeClass = NodeClass.Object;
BaseObject.typeDefinition = resolveNodeId("BaseObjectType");

BaseObject.prototype.readAttribute = function (attributeId) {
    var options = {};
    switch (attributeId) {
        case AttributeIds.EventNotifier:
            options.value = { dataType: DataType.UInt32, value: this.eventNotifier };
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this,attributeId);
    }
    return new DataValue(options);
};

function View(options) {
    BaseNode.apply(this, arguments);
    this.containsNoLoops = options.containsNoLoops ? true : false;
    this.eventNotifier = 0;
}
util.inherits(View, BaseNode);
View.prototype.nodeClass = NodeClass.View;

View.prototype.readAttribute = function (attributeId) {

    var options = {};

    switch (attributeId) {
        case AttributeIds.EventNotifier:
            options.value = { dataType: DataType.UInt32, value: this.eventNotifier };
            break;
        case AttributeIds.ContainsNoLoops:
            options.value = { dataType: DataType.Boolean, value: this.containsNoLoops };
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this,attributeId);
    }
    return new DataValue(options);
};

function Folder(options) {

    assert(options);
    assert(options.nodeId);
    assert(options.browseName);

    BaseObject.apply(this, arguments);

    assert(this.typeDefinition.value === 61);

    this.elements = [];
}
util.inherits(Folder, BaseObject);

var _constructors = {};
function registerConstructor(ConstructorFunc, nodeId) {
    ConstructorFunc.prototype.typeDefinition = resolveNodeId(nodeId);
    _constructors[ConstructorFunc.prototype.typeDefinition.toString()] = ConstructorFunc;
}
registerConstructor(Folder, "FolderType");

function VariableType(options) {

    assert(options.dataType, "dataType is mandatory");
    this.value = options.value;     // optional default value for instances of this VariableType
    this.dataType = options.dataType;   // DataType (NodeId)
    this.valueRank = options.valueRank;  // UInt32
    this.arrayDimensions = [];
    this.isAbstract = options.isAbstract;  // false indicates that the VariableType cannot be used  as type definition
}
util.inherits(VariableType, BaseNode);

VariableType.prototype.readAttribute = function (attributeId) {
    var options = {};
    switch (attributeId) {
        case AttributeIds.IsAbstract:
            options.value = { dataType: DataType.Boolean, value: this.isAbstract ? true : false };
            break;
        case AttributeIds.Value:
            if (this.hasOwnProperty("value")) {
                assert(this.value._schema.name === "Variant");
                options.value = this.value;
            } else {
                console.log(" warning Value not implemented");
                options.value = { dataType: DataType.UInt32, value: 0 };
                options.statusCode = StatusCodes.Bad_AttributeIdInvalid;
            }
            break;
        case AttributeIds.DataType:
            options.value = { dataType: DataType.NodeId, value: this.dataType };
            break;
        case AttributeIds.ValueRank:
            options.value = { dataType: DataType.UInt32, value: this.valueRank };
            break;
        case AttributeIds.ArrayDimensions:
            options.value = { dataType: DataType.UInt32, value: this.arrayDimensions };
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this,attributeId);
    }
    return new DataValue(options);
};


function Variable(options) {

    BaseNode.apply(this, arguments);

    assert(this.typeDefinition.value === resolveNodeId("VariableType").value);

    this.value = options.value;
}

util.inherits(Variable, BaseNode);
registerConstructor(Variable, "VariableType");

Variable.prototype.readAttribute = function (attributeId) {

    var options = {};

    switch (attributeId) {
        case AttributeIds.Value:
            if (obj.hasOwnProperty("value")) {
                assert(this.value._schema.name === "Variant");
                options.value = this.value;
            } else {
                console.log(" warning Value not implemented");
                options.value = { dataType: DataType.UInt32, value: 0 };
                options.statusCode = StatusCodes.Bad_AttributeIdInvalid;
            }
            break;
        case AttributeIds.DataType:
            console.log(" warning DataType not implemented");
            options.value = { dataType: DataType.NodeId, value: ec.makeNodeId(0) };
            options.statusCode = StatusCodes.Bad_AttributeIdInvalid;
            break;
        case AttributeIds.ValueRank:
            console.log(" warning ValueRank not implemented");
            options.value = { dataType: DataType.UInt32, value: 0 };
            options.statusCode = StatusCodes.Bad_AttributeIdInvalid;
            break;
        case AttributeIds.ArrayDimensions:
            console.log(" warning ValueRank not implemented");
            options.value = { dataType: DataType.UInt32, value: 0 };
            options.statusCode = StatusCodes.Bad_AttributeIdInvalid;
            break;
        case AttributeIds.AccessLevel:
            console.log(" warning AccessLevel not implemented");
            options.value = { dataType: DataType.UInt32, value: 0 };
            options.statusCode = StatusCodes.Bad_AttributeIdInvalid;
            break;
        case AttributeIds.UserAccessLevel:
            console.log(" warning UserAccessLevel not implemented");
            options.value = { dataType: DataType.UInt32, value: 0 };
            options.statusCode = StatusCodes.Bad_AttributeIdInvalid;
            break;
        case AttributeIds.MinimumSamplingInterval:
            console.log(" warning MinimumSamplingInterval not implemented");
            options.value = { dataType: DataType.UInt32, value: 0 };
            options.statusCode = StatusCodes.Bad_AttributeIdInvalid;
            break;
        case AttributeIds.Historizing:
            console.log(" warning Historizing not implemented");
            options.value = { dataType: DataType.UInt32, value: 0 };
            options.statusCode = StatusCodes.Bad_AttributeIdInvalid;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this,attributeId);
    }
    return new DataValue(options);


};


function Method(options) {

    BaseNode.apply(this, arguments);

    assert(this.typeDefinition.value === resolveNodeId("MethodType").value);

    this.value = options.value;
}
util.inherits(Method, BaseNode);
registerConstructor(Method, "MethodType");

Method.prototype.readAttribute = function (attributeId) {

    var options = {};
    switch (attributeId) {
        case AttributeIds.Executable:
            console.log(" warning Executable not implemented");
            options.value = { dataType: DataType.UInt32, value: 0 };
            options.statusCode = StatusCodes.Bad_AttributeIdInvalid;
            break;
        case AttributeIds.UserExecutable:
            console.log(" warning UserExecutable not implemented");
            options.value = { dataType: DataType.UInt32, value: 0 };
            options.statusCode = StatusCodes.Bad_AttributeIdInvalid;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this,attributeId);
    }
    return new DataValue(options);
};


function ServerEngine() {

    this._nodeid_index = {};
    this._browsename_index = {};
    this.rootFolder = new Folder({ nodeId: "RootFolder", browseName: "Root" });
    assert(this.rootFolder.readAttribute);
    this._private_namespace = 1;
    this._internal_id_counter = 1000;

    this._register(this.rootFolder);
    this._add_objects_folder();
}


ServerEngine.prototype._register = function (object) {

    assert(object.nodeId);
    assert(!this._nodeid_index.hasOwnProperty(object.nodeId.toString()), " nodeid already registered");
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

    if (typeof options === "string") {
        options = { browseName: options };
    }

    options.nodeId = options.nodeId || this._build_new_NodeId();
    options.hasTypeDefinition = "FolderType";
    options.back_references = [
        { referenceTypeId: this._resolveNodeId("Organizes"), nodeId: parentFolder.nodeId }
    ];

    var folder = this._createObject(options);
    folder.parent = parentFolder;
    return folder;
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

ServerEngine.prototype._createObject = function (options) {

    assert(options.hasTypeDefinition, "must have options.hasTypeDefinition");
    var typeDefinitionId = this._resolveNodeId(options.hasTypeDefinition);

    var ConsructorFunc = _constructors[typeDefinitionId.toString()];

    var object = new ConsructorFunc(options);

    this._register(object);
    var self = this;

    if (options.references) {
        options.references.forEach(function (reference) {
            var nodeId = reference.nodeId;
            var parent = self.findObject(nodeId);
            object._add_forward_reference(reference.referenceTypeId, parent.nodeId);
            parent._add_backward_reference(reference.referenceTypeId, object.nodeId);
        });
    }
    if (options.back_references) {
        options.back_references.forEach(function (reference) {
            var nodeId = reference.nodeId;
            var parent = self.findObject(nodeId);
            object._add_backward_reference(reference.referenceTypeId, parent.nodeId);
            parent._add_forward_reference(reference.referenceTypeId, object.nodeId);
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




ServerEngine.prototype._makeReferenceDescription = function (reference, isForward) {

    var referenceTypeId = reference.referenceTypeId;
    var obj = this.findObject(reference.nodeId);

    var data = {
        referenceTypeId: referenceTypeId,
        isForward: isForward,
        nodeId: obj.nodeId,
        browseName: coerceQualifyName(obj.browseName),
        displayName: coerceLocalizedText(obj.displayName[0]),
        nodeClass: obj.nodeClass,
        typeDefinition: obj.typeDefinition
    };

    return new browse_service.ReferenceDescription(data)
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
        var f = [];
        if (browseDirection === BrowseDirection.Forward || browseDirection === BrowseDirection.Both) {
            f = obj.references.map(function (reference) {
                return self._makeReferenceDescription(reference, true);
            });
        }
        var b = [];
        if (browseDirection === BrowseDirection.Inverse || browseDirection === BrowseDirection.Both) {
            b = obj.back_references.map(function (reference) {
                return self._makeReferenceDescription(reference, false);
            });
        }
        browseResult.references = f.concat(b);

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

