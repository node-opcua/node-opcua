
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
var _ = require("underscore");



var _constructors = {};
function registerConstructor(ConstructorFunc, nodeId) {
    ConstructorFunc.prototype.typeDefinition = resolveNodeId(nodeId);
    _constructors[ConstructorFunc.prototype.typeDefinition.toString()] = ConstructorFunc;
}


/**
 *
 * @param object
 * @param strReference
 * @param isForward
 * @returns {*}
 */
function findReference(object,strReference,isForward) {
    assert( undefined !== object," missing reference ");
    isForward = (isForward === null)? true: isForward;

    assert(object.references);
    var f = _.find(object.references,function(ref){
            return ref.referenceType == strReference && ref.isForward == isForward}
    );
    return f;
}
exports.findReference = findReference;

/**
 * BaseNode is the base class for all the OPCUA objects in the address space
 * It provides attributes and a set of references to other nodes.
 *
 * @param options
 * @constructor
 */
function BaseNode(options) {

    Object.defineProperty(this, "__address_space", { value: options.address_space, enumerable: false });

    this.nodeId = resolveNodeId(options.nodeId);

    this.browseName = options.browseName;

    options.displayName = options.displayName || options.browseName; // xx { locale: "en", text: options.browseName };

    this.displayName = [];
    if (typeof options.displayName === "string") {
        this.displayName.push(new s.LocalizedText({ locale: null, text: options.displayName }));
    }
    this.references = options.references || [];
    this.back_references = [];

    this._cache = {};

    var td = findReference(options,"HasTypeDefinition",true);
    this._cache.hasTypeDefinition = td ? td.nodeId : null;

    td = findReference(options,"Organizes",false);
    this._cache.parent    = td ? td.nodeId : null;
};

BaseNode.prototype.__defineGetter__("hasTypeDefinition", function(){
    return this._cache.hasTypeDefinition;
});

BaseNode.prototype.__defineGetter__("parent",function(){
    return this._cache.parent;
});


BaseNode.prototype._add_backward_reference = function(reference) {
    assert(reference.referenceType !== null);
    assert(reference.isForward !== null);
    assert(reference.nodeId!== null);
    this.back_references.push(reference);
};

/**
 *
 * @param node
 */
BaseNode.prototype.propagate_back_references = function(address_space) {

    var node = this;
    node.references.forEach(function(reference){

        if (reference.referenceType === "Organizes" ) {
            var parent = address_space.findObject(reference.nodeId);
            if (parent) {
                parent._add_backward_reference({
                    referenceType: reference.referenceType,
                    isForward: !reference.isForward,
                    nodeId: node.nodeId
                });
            } // else address_space may be incomplete
        }
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
        typeDefinition:  obj.hasTypeDefinition
    };
    if (data.typeDefinition === null ) {
        data.typeDefinition = resolveNodeId("i=0");
        console.log(" WARNING");
        console.log(util.inspect(obj,{colors:true,depth:10}));
    }
    return new browse_service.ReferenceDescription(data)
};

/**
 *
 * @param options
 * @param address_space an object that provides access to address_space objects by nodeId
 */
BaseNode.prototype.browseNode = function(address_space,browseDescription) {

    var self = this;

    var browseDirection = browseDescription.browseDirection || BrowseDirection.Both;

    // get all possible references
    var references = self.references.concat(self.back_references);

    // ignore default nodeids in browseDescription.referenceTypeId
    if (browseDescription.referenceTypeId && browseDescription.referenceTypeId.value ===0 ) {
        browseDescription.referenceTypeId = null;
    }
    if (browseDescription.referenceTypeId) {

        assert(typeof browseDescription.referenceTypeId === 'string');

        references = references.filter(function(reference){
            //xx console.log( reference.referenceType, browseDescription.referenceTypeId);
            return reference.referenceType === browseDescription.referenceTypeId;
        });
    }
    var f = [];
    if (browseDirection === BrowseDirection.Forward || browseDirection === BrowseDirection.Both) {
        f = references.filter(function(reference){ return reference.isForward;}).map(function (reference) {
            return _makeReferenceDescription(address_space,reference, true);
        });
    }
    var b = [];
    if (browseDirection === BrowseDirection.Inverse || browseDirection === BrowseDirection.Both) {
        b = references.filter(function(reference){ return !reference.isForward;}).map(function (reference) {
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
    this.isAbstract  = (options.isAbstract === null) ? false : options.isAbstract;
    this.symmetric   =  (options.symmetric === null) ? false : options.symmetric;
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
 * @param options
 * @constructor
 */
function UADataType(options) {
    BaseNode.apply(this, arguments);
};
util.inherits(UADataType, BaseNode);


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

//function Method(options) {
//
//    BaseNode.apply(this, arguments);
//
//    assert(this.typeDefinition.value === resolveNodeId("MethodType").value);
//
//    this.value = options.value;
//}
//util.inherits(Method, BaseNode);
//registerConstructor(Method, "MethodType");
//
//Method.prototype.readAttribute = function (attributeId) {
//
//    var options = {};
//    switch (attributeId) {
//        case AttributeIds.Executable:
//            console.log(" warning Executable not implemented");
//            options.value = { dataType: DataType.UInt32, value: 0 };
//            options.statusCode = StatusCodes.Bad_AttributeIdInvalid;
//            break;
//        case AttributeIds.UserExecutable:
//            console.log(" warning UserExecutable not implemented");
//            options.value = { dataType: DataType.UInt32, value: 0 };
//            options.statusCode = StatusCodes.Bad_AttributeIdInvalid;
//            break;
//        default:
//            return BaseNode.prototype.readAttribute.call(this,attributeId);
//    }
//    return new DataValue(options);
//};


/**
 *
 * @constructor
 */
function AddressSpace() {
    this._nodeid_index = {};
    this._browsename_index = {};
}

/**
 *
 * @param nodeId
 * @returns {BaseNode}
 */
AddressSpace.prototype.findObject = function (nodeId) {
    nodeId = this._resolveNodeId(nodeId);
    return this._nodeid_index[nodeId.toString()];
};

/**
 *
 * @param browseNameToFind { string }
 * @returns {BaseNode}
 */
AddressSpace.prototype.findByBrowseName = function(browseNameToFind) {
    return _.find(_nodeid_index,function(el){ return el.browseName === browseNameToFind});
};

AddressSpace.prototype._register = function (object) {

    if (this._nodeid_index.hasOwnProperty(object.nodeId.toString())) {
        console.log(util.inspect(object,{colors:true,depth:5}));
    }
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


var _constructors = {
    "Object":            BaseObject,
    "ReferenceType":     ReferenceType,
    "Variable"     :     Variable,
    "ObjectType":        BaseObject,
    "DataType":          UADataType,
};
/**
 *
 * @param options
 * @returns {constructor}
 * @private
 */
AddressSpace.prototype._createObject = function(options) {
    assert(options.nodeClass);
    var constructor = _constructors[options.nodeClass.key];
    assert(constructor," missing constructor for " + options.nodeClass.key);
    options.address_space = this;
    var obj = new constructor(options);
    this._register(obj);
    return obj;
};

exports.AddressSpace = AddressSpace;
