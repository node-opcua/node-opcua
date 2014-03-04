
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


var dumpIf = require("../utils").dumpIf;

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

    dumpIf(!this.nodeClass,this);
    assert(this.nodeClass);
};

BaseNode.prototype.__defineGetter__("hasTypeDefinition", function(){
    return this._cache.hasTypeDefinition;
});

BaseNode.prototype.__defineGetter__("parent",function(){
    return this._cache.parent;
});

BaseNode.prototype.resolveNodeId = function(nodeId) {
    return this.__address_space.resolveNodeId(nodeId);
};

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
            options.value = { dataType: DataType.Int32, value: this.nodeClass.value };
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

BaseNode.prototype.write = function(writeValue) {
    return StatusCodes.Bad_NotWritable;
};

BaseNode.prototype.full_name = function() {

    if (this.parentNodeId) {
        var parent = this.__address_space.findObject(this.parentNodeId);
        if (parent) {
            return parent.full_name() + "." + this.browseName +"";
        } else {
            return "<NOT YET REGISTERED>" + this.parentNodeId.toString() + "." + this.browseName +"";
        }
    }
    return this.browseName;
};



var _makeReferenceDescription = function (address_space,reference, isForward) {

    var referenceTypeId = address_space.findObjectByBrowseName(reference.referenceType).nodeId;
    assert(referenceTypeId instanceof NodeId);

    var obj = address_space.findObject(reference.nodeId);

    var data = {};

    if (!obj) {
        // cannot find reference node
        data = {
            referenceTypeId: referenceTypeId,
            isForward:       isForward,
            nodeId:          reference.nodeId
        };
    } else {
        assert(reference.nodeId , obj.nodeId);
        data = {
            referenceTypeId: referenceTypeId,
            isForward:       isForward,
            nodeId:          obj.nodeId,
            browseName:      coerceQualifyName(obj.browseName),
            displayName:     coerceLocalizedText(obj.displayName[0]),
            nodeClass:       obj.nodeClass,
            typeDefinition:  obj.hasTypeDefinition
        };
    }
    if (data.typeDefinition === null ) {
        data.typeDefinition = resolveNodeId("i=0");
        //xx console.log("typeDefinition === null" , util.inspect(obj,{colors:true,depth:10}));
    }
    assert(referenceTypeId instanceof NodeId);
    return new browse_service.ReferenceDescription(data)
};

/**
 *
 * @param address_space an object that provides access to address_space objects by nodeId
 * @param browseDescription
 */
BaseNode.prototype.browseNode = function(browseDescription) {

    var self = this;
    var address_space = self.__address_space;

    var browseDirection = browseDescription.browseDirection || BrowseDirection.Both;

    // get all possible references
    var references = self.references.concat(self.back_references);

    // ignore default nodeids in browseDescription.referenceTypeId
    if (browseDescription.referenceTypeId && browseDescription.referenceTypeId.value ===0 ) {
        browseDescription.referenceTypeId = null;
    }

    // make sure we have a valid referenceTypeId if not null
    if (browseDescription.referenceTypeId) {

        if (browseDescription.referenceTypeId instanceof NodeId) {
            var rf = this.__address_space.findObject(browseDescription.referenceTypeId);
            browseDescription.referenceTypeId=  rf.browseName;
        }
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
};

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
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.Symmetric:
            options.value = { dataType: DataType.Boolean, value: this.symmetric ? true : false };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.InverseName: // LocalizedText
            options.value = { dataType: DataType.LocalizedText, value: this.inverseName  };
            options.statusCode = StatusCodes.Good;
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
            options.statusCode = StatusCodes.Good;
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
UADataType.prototype.nodeClass = NodeClass.DataType;

/**
 *
 * @param options
 * @constructor
 */
function VariableType(options) {
    BaseNode.apply(this, arguments);
    //xx dumpif(!options.dataType,options);
    //xx assert(options.isAbstract || options.dataType, "dataType is mandatory if variable type is not abstract");
    this.value = options.value;          // optional default value for instances of this VariableType
    this.dataType = options.dataType;    // DataType (NodeId)
    this.valueRank = options.valueRank;  // UInt32
    this.arrayDimensions = [];
    this.isAbstract = options.isAbstract;  // false indicates that the VariableType cannot be used  as type definition
}
util.inherits(VariableType, BaseNode);
VariableType.prototype.nodeClass = NodeClass.VariableType;

VariableType.prototype.readAttribute = function (attributeId) {
    var options = {};
    switch (attributeId) {
        case AttributeIds.IsAbstract:
            options.value = { dataType: DataType.Boolean, value: this.isAbstract ? true : false };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.Value:
            if (this.hasOwnProperty("value") && this.value !== undefined) {
                assert(this.value._schema.name === "Variant");
                options.value = this.value;
                options.statusCode = StatusCodes.Good;
            } else {
                console.log(" warning Value not implemented");
                options.value = { dataType: DataType.UInt32, value: 0 };
                options.statusCode = StatusCodes.Bad_AttributeIdInvalid;
            }
            break;
        case AttributeIds.DataType:
            options.value = { dataType: DataType.NodeId, value: this.dataType };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.ValueRank:
            options.value = { dataType: DataType.UInt32, value: this.valueRank };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.ArrayDimensions:
            options.value = { dataType: DataType.UInt32, value: this.arrayDimensions };
            options.statusCode = StatusCodes.Good;
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
            options.value = { dataType: DataType.Byte, value: this.eventNotifier };
            options.statusCode = StatusCodes.Good;
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
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.ContainsNoLoops:
            options.value = { dataType: DataType.Boolean, value: this.containsNoLoops };
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this,attributeId);
    }
    return new DataValue(options);
};

function Variable(options) {

    BaseNode.apply(this, arguments);

    assert(this.typeDefinition.value === this.resolveNodeId("VariableType").value);

    this.value = options.value;


    this.dataType =  this.resolveNodeId(options.dataType);    // DataType (NodeId)
    this.valueRank = options.valueRank;  // UInt32
    this.arrayDimensions = options.arrayDimensions;
    this.minimumSamplingInterval  = options.minimumSamplingInterval;

    this.parentNodeId = options.parentNodeId;

    this.historizing = options.historizing;

    assert(this.dataType instanceof NodeId);
    assert(_.isFinite(this.minimumSamplingInterval));
}


util.inherits(Variable, BaseNode);
Variable.prototype.nodeClass = NodeClass.Variable;
registerConstructor(Variable, "VariableType");

Variable.prototype.get_variant = function() {
    if (!this.value) {
        console.log(" variable has not been bound ( node id = ", this.nodeId.toString() + " )");
        return new Variant();
    }
    assert(this.value._schema.name === "Variant");


    return this.value;
};

Variable.prototype.readAttribute = function (attributeId) {

    var options = {};

    switch (attributeId) {
        case AttributeIds.Value:
            options.value = this.get_variant();
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.DataType:
            options.value = { dataType: DataType.NodeId, value: this.dataType};
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.ValueRank:
            var valueRank = this.valueRank;
            options.value = { dataType: DataType.Int32, value: valueRank };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.ArrayDimensions:
            options.value = { dataType: DataType.UInt32, value: this.arrayDimensions };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.AccessLevel:
            options.value = { dataType: DataType.UInt32, value: this.accessLevel };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.UserAccessLevel:
            options.value = { dataType: DataType.UInt32, value: this.userAccessLevel };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.MinimumSamplingInterval:
            if (this.minimumSamplingInterval === undefined) {
                options.statusCode = StatusCodes.Bad_AttributeIdInvalid;
            } else {
                options.value = { dataType: DataType.UInt32, value: this.minimumSamplingInterval };
                options.statusCode = StatusCodes.Good;
            }
            break;
        case AttributeIds.Historizing:
            options.value = { dataType: DataType.Boolean, value: this.historizing };
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this,attributeId);
    }
    return new DataValue(options);


};

Variable.prototype.write = function(writeValue) {


    var statusCode = StatusCodes.Bad_NotWritable;
    if (this._set_func) {
        statusCode = this._set_func(writeValue.value) || StatusCodes.Bad_NotWritable;
    } else {
        this.value = writeValue.value.value;
    }
    return statusCode;
};

/**
 * bind a variable with a get and set functions
 * @param options
 */
Variable.prototype.bindVariable =function(options) {
    options = options || {};
    this._get_func =options.get;
    this._set_func =options.set;
    Object.defineProperty(this,"value",{
        get: options.get,
        set: options.set || function() {},
        enumerable: true
    })
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
    this._aliases = {};
}

/**
 *
 * @param alias_name
 * @param nodeId
 */
AddressSpace.prototype.add_alias = function(alias_name,nodeId) {
    assert(typeof alias_name === "string");
    assert(nodeId instanceof NodeId);
    this._aliases[alias_name] = nodeId;
}

/**
 *
 * @param nodeId
 * @returns {BaseNode}
 */
AddressSpace.prototype.findObject = function (nodeId) {
    nodeId = this.resolveNodeId(nodeId);
    return this._nodeid_index[nodeId.toString()];
};

/**
 *
 * @param browseNameToFind { string }
 * @returns {BaseNode}
 */
AddressSpace.prototype.findObjectByBrowseName = function(browseNameToFind) {
    return this._browsename_index[browseNameToFind];
};

AddressSpace.prototype._register = function (object) {

    assert(object.nodeId);
    assert(object.hasOwnProperty("browseName"));

    assert(!this._nodeid_index.hasOwnProperty(object.nodeId.toString()), " nodeId already registered");

    var fullname = object.full_name();

    if(this._browsename_index.hasOwnProperty(fullname)) {
        console.log("registering ",fullname, " ", object.nodeId.toString());
        var o = this._browsename_index[fullname];
        console.log("registering ",o.nodeId.toString());
      //xx  throw new Error("browseName already registered");
    }
    //xx assert(!this._browsename_index.hasOwnProperty(fullname),"browseName already registered");
    this._nodeid_index[object.nodeId.toString()] = object;
    this._browsename_index[fullname] = object;
};

AddressSpace.prototype.resolveNodeId = function (nodeid) {

    if (typeof nodeid === "string") {
        // check if the string is a known alias
        if (this._aliases.hasOwnProperty(nodeid)) {
          return this._aliases[nodeid];
        }
        // check if the string is a known browse Name
        if (this._browsename_index.hasOwnProperty(nodeid)) {
            return this._browsename_index[nodeid].nodeId;
        }
    }
    return resolveNodeId(nodeid);
};

var _constructors_map = {
    "Object":            BaseObject,
    "ObjectType":        BaseObject,
    "ReferenceType":     ReferenceType,
    "Variable"     :     Variable,
    "VariableType":      VariableType,
    "DataType":          UADataType
};
/**
 *
 * @param options
 * @returns {constructor}
 * @private
 */
AddressSpace.prototype._createObject = function(options) {

    dumpIf(!options.nodeId,options);
    assert(options.nodeClass);
    assert(typeof options.browseName === "string");

    var constructor = _constructors_map[options.nodeClass.key];
    assert(constructor," missing constructor for " + options.nodeClass.key);
    options.address_space = this;
    var obj = new constructor(options);
    assert(obj.nodeId);
    this._register(obj);

    //xx console.log("full_name" ,obj.full_name());
    //xx assert(this.findObjectByBrowseName(obj.full_name()) === obj);

    return obj;
};

exports.AddressSpace = AddressSpace;
