
var NodeClass = require("../../lib/browse_service").NodeClass;
var NodeId = require("../../lib/nodeid").NodeId;

var resolveNodeId = require("../../lib/nodeid").resolveNodeId;
var s = require("../../lib/structures");
var coerceQualifyName = s.coerceQualifyName;
var coerceLocalizedText = s.coerceLocalizedText;

var DataValue = require("../datavalue").DataValue;
var Variant = require("../variant").Variant;
var DataType = require("../variant").DataType;
var StatusCodes = require("../../lib/opcua_status_code").StatusCodes;
var read_service = require("../../lib/read_service");
var AttributeIds = read_service.AttributeIds;

var browse_service = require("../../lib/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

var assert  = require("better-assert");
var util = require("util");





var _constructors = {};
function registerConstructor(ConstructorFunc, nodeId) {
    ConstructorFunc.prototype.typeDefinition = resolveNodeId(nodeId);
    _constructors[ConstructorFunc.prototype.typeDefinition.toString()] = ConstructorFunc;
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


var _makeReferenceDescription = function (address_space,reference, isForward) {

    var referenceTypeId = reference.referenceTypeId;
    var obj = address_space.findObject(reference.nodeId);

    var data = {
        referenceTypeId: referenceTypeId,
        isForward:       isForward,
        nodeId:          obj.nodeId,
        browseName:      coerceQualifyName(obj.browseName),
        displayName:     coerceLocalizedText(obj.displayName[0]),
        nodeClass:       obj.nodeClass,
        typeDefinition:  obj.typeDefinition
    };

    return new browse_service.ReferenceDescription(data)
};

/**
 *
 * @param options
 * @param address_space an object that provides access to address_space objects by nodeId
 */
BaseNode.prototype.browseNode = function(address_space,options) {

    var self = this;

    var browseDirection = options.browseDirection;

    var f = [];
    if (browseDirection === BrowseDirection.Forward || browseDirection === BrowseDirection.Both) {
        f = self.references.map(function (reference) {
            return _makeReferenceDescription(address_space,reference, true);
        });
    }
    var b = [];
    if (browseDirection === BrowseDirection.Inverse || browseDirection === BrowseDirection.Both) {
        b = self.back_references.map(function (reference) {
            return _makeReferenceDescription(address_space,reference, false);
        });
    }
    var references = f.concat(b);
    return references;
}
exports.BaseNode = BaseNode;




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
exports.ReferenceType = ReferenceType;


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
exports.ObjectType = ObjectType;

/**
 *
 * @param options
 * @constructor
 */
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

exports.VariableType = VariableType;



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
registerConstructor(Folder, "FolderType");
exports.Folder = Folder;



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
exports.Variable = Variable;


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


function AddressSpace()
{
    this._nodeid_index = {};
    this._browsename_index = {};
}

AddressSpace.prototype.findObject = function (nodeId) {
    nodeId = this._resolveNodeId(nodeId);
    return this._nodeid_index[nodeId.toString()];
};


AddressSpace.prototype._register = function (object) {

    assert(object.nodeId);
    assert(!this._nodeid_index.hasOwnProperty(object.nodeId.toString()), " nodeid already registered");
    this._nodeid_index[object.nodeId.toString()] = object;
    this._browsename_index[object.browseName] = object.nodeId;
};

AddressSpace.prototype._resolveNodeId = function (nodeid) {

    if (typeof nodeid === "string") {
        // check if the string is a known browse Name
        if (this._browsename_index.hasOwnProperty(nodeid)) {
            return this._browsename_index[nodeid];
        }
    }
    return resolveNodeId(nodeid);
};

/**
 *
 * @param typeDefinitionId
 * @returns {ConsructorFunc}
 */
AddressSpace.prototype.___constructObject = function(options) {

    var self = this;

    var typeDefinitionId = options.typeDefinitionId;

    assert(typeDefinitionId instanceof NodeId);

    var ConsructorFunc = _constructors[typeDefinitionId.toString()];

    var object = new ConsructorFunc(options);
    assert(object.nodeId instanceof NodeId);

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
    return object;
};

AddressSpace.prototype._createObject = function (options) {

    assert(options.hasTypeDefinition, "must have options.hasTypeDefinition");
    options.typeDefinitionId = this._resolveNodeId(options.hasTypeDefinition);

    var object = this.___constructObject(options);
    this._register(object);

    return object;
};

exports.AddressSpace = AddressSpace;
