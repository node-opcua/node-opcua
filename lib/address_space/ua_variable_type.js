"use strict";

/**
 * @module opcua.address_space
 */
require("requirish")._(module);
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;

var NodeId = require("lib/datamodel/nodeid").NodeId;
var DataValue = require("lib/datamodel/datavalue").DataValue;
var Variant  = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;

var assert = require("better-assert");
var util = require("util");
var utils = require("lib/misc/utils");
var _ = require("underscore");

var BaseNode = require("lib/address_space/base_node").BaseNode;

var coerceNodeId = require("lib/datamodel/nodeid").coerceNodeId;

function prepareDataType(dataType) {
    return coerceNodeId(dataType);
}


/**
 * @class UAVariableType
 * @extends  BaseNode
 * @param options
 * @constructor
 */
function UAVariableType(options) {

    BaseNode.apply(this, arguments);

    this.isAbstract = utils.isNullOrUndefined(options.isAbstract) ? false : options.isAbstract;

    this.value = options.value;          // optional default value for instances of this UAVariableType

    this.dataType = prepareDataType(options.dataType);    // DataType (NodeId)

    this.valueRank = options.valueRank || 0;  // Int32

    // see OPC-UA part 5 : $3.7 Conventions for Node descriptions
    this.arrayDimensions = options.arrayDimensions || [];

    assert(_.isArray(this.arrayDimensions));
}

util.inherits(UAVariableType, BaseNode);
UAVariableType.prototype.nodeClass = NodeClass.VariableType;

UAVariableType.prototype.readAttribute = function (attributeId) {
    var options = {};
    switch (attributeId) {
        case AttributeIds.IsAbstract:
            options.value = {dataType: DataType.Boolean, value: this.isAbstract ? true : false};
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.Value:
            if (this.hasOwnProperty("value") && this.value !== undefined) {
                assert(this.value._schema.name === "Variant");
                options.value = this.value;
                options.statusCode = StatusCodes.Good;
            } else {
                console.log(" warning Value not implemented");
                options.value = {dataType: DataType.UInt32, value: 0};
                options.statusCode = StatusCodes.BadAttributeIdInvalid;
            }
            break;
        case AttributeIds.DataType:
            assert(this.dataType instanceof NodeId);
            options.value = {dataType: DataType.NodeId, value: this.dataType};
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.ValueRank:
            options.value = {dataType: DataType.Int32, value: this.valueRank};
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.ArrayDimensions:
            assert(_.isArray(this.arrayDimensions) || this.arrayDimensions === null);
            options.value = {dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: this.arrayDimensions};
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this, attributeId);
    }
    return new DataValue(options);
};


var tools = require("./tool_isSupertypeOf");
UAVariableType.prototype.isSupertypeOf = tools.construct_isSupertypeOf(UAVariableType);

UAVariableType.prototype.__defineGetter__("subtypeOfObj", function () {
    if (!this._cache.subtypeOf) {
        var tmp = this.findReferencesAsObject("HasSubtype", false);
        this._cache.subtypeOf = tmp.length > 0 ? tmp[0] : null;
    }
    return this._cache.subtypeOf;
});


function getModellingRule(node) {
    var r = node.findReferencesAsObject("HasModellingRule");
    if (!r || r.length === 0) {
        console.log("Warning: HasModellingRule is missing in node "+ node.browseName.toString());
        return "Mandatory"; // consider "Mandatory"
    }
    r = r[0];
    return r.browseName.toString();
}

function OnlyMandatoryChildrenOrRequestedOptionals(references,optionals,node) {

    assert(_.isArray(optionals));

    var address_space = node.__address_space;

    var alreadyIn = references.filter(function(r){
        var n =address_space.findObject(r.nodeId);
        assert(_.isObject(n) || false);

        var isAlreadyIn =n.browseName.name.toString() === node.browseName.name.toString();
        return isAlreadyIn ;
    });
    if(alreadyIn.length > 0) {
        // a child with the same browse name has already been install
        // probably froma SuperClass, we should ignore this.
        return false; // ignore
    }
    var modellingRule = getModellingRule(node);

    switch (modellingRule) {
        case null:
            //
            return false; // skip
        case "Mandatory":
            return true; // keep;
        case "Optional":
            // only if in requested optionals
            var index = optionals.indexOf(node.browseName.name);
            return index >= 0;
            break;
        case "OptionalPlaceHolder":
            return false; // ignore
        default:
            return false; // ignore
    }
}


function CloneHelper()
{
    this.mapOrgToClone = {};
    this.mapCloneToObj = {};
}

CloneHelper.prototype.registerClonedObject = function(objInType,clonedObj) {

    this.mapOrgToClone[objInType.nodeId.toString()] = {
        original: objInType,
        cloned: clonedObj
    };
    this.mapCloneToObj[objInType.nodeId.toString()] = {
        original: objInType,
        cloned: clonedObj
    };

};

// install properties and components on a instantiate Object
//
// based on their ModelingRule
//  => Mandatory                 => Installed
//  => Optional                  => Not Installed , unless it appear in optionals array
//  => OptionalPlaceHolder       => Not Installed
//  => null (no modelling ruleà) =>  Not Installed
function _initialize_properties_and_components(topMostType,self, references,optionals, extraInfo) {

    optionals = optionals || [];

    var address_space = topMostType.__address_space;

    if (topMostType.nodeId === self.nodeId) {
        return; // nothing to do
    }

    var baseTypeNodeId = self.subtypeOf;
    // istanbul ignore next
    if (!baseTypeNodeId) {
        throw new Error("Object with nodeId " + self.nodeId + " has no Type");
    }

    var baseType = address_space.findObject(baseTypeNodeId);

    // istanbul ignore next
    if (!baseType) {
        throw new Error("Cannot find object with nodeId ".red + baseTypeNodeId);
    }

    var r = self._clone_references(OnlyMandatoryChildrenOrRequestedOptionals.bind(null,references,optionals),extraInfo);

    Array.prototype.push.apply(references, r);

    // get properties and components from base class
    _initialize_properties_and_components(topMostType,baseType, references,optionals , extraInfo);


}


    /**
 * returns true if the parent object has a child  with the provided browseName
 * @param parent
 * @param childBrowseName
 */
function hasChildWithBrowseName(parent,childBrowseName) {

    assert(parent instanceof BaseNode);
    // extract children
    var children = parent.findReferencesAsObject("HasChild", true);

    return children.filter(function(child){
        return child.browseName.name.toString()  === childBrowseName;
    }).length > 0;

}

function getParent(options) {
    var parent = options.componentOf || options.organizedBy ;
    return parent;
}
function assertUnusedChildBrowseName(address_space,options) {

    function resolveOptionalObject(obj) {
        return  obj ? address_space._coerceObject(obj) : null;
    }
    options.componentOf = resolveOptionalObject(options.componentOf);
    options.organizedBy = resolveOptionalObject(options.organizedBy);

    assert(!(options.componentOf && options.organizedBy));

    var parent = getParent(options);
    if (!parent) {
        return;
    }
    assert(_.isObject(parent));
    // verify that no components already exists in parent
    if( parent && hasChildWithBrowseName(parent,options.browseName)){
        throw new Error("object " + parent.browseName.name.toString() +
            " have already a child with browseName " + options.browseName.toString());
    }

}
exports.assertUnusedChildBrowseName = assertUnusedChildBrowseName;
exports.initialize_properties_and_components = initialize_properties_and_components;

var browse_service = require("lib/services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

/**
 * recreate functional group types according to type definition
 *
 * @method reconstructFunctionalGroupType
 * @param baseType
 */

/* @example:
 *
 *    MyDeviceType
 *        |
 *        +----------|- ParameterSet(BaseObjectType)
 *        |                   |
 *        |                   +-----------------|- Parameter1
 *        |                                             ^
 *        +----------|- Config(FunctionalGroupType)     |
 *                                |                     |
 *                                +-------- Organizes---+
 */
function reconstructFunctionalGroupType(extraInfo)
{
    // navigate through original object to find those that are being organized by some FunctionalGroup
    _.forEach(extraInfo.mapOrgToClone,function(value,key){

        var originalObject = value.original;
        var instantiatedObject = value.cloned;
        var organizedByArray = originalObject.findReferencesEx("Organizes",BrowseDirection.Inverse);


        var addressSpace = originalObject.__address_space;

        //function dumpRef(r) {
        //    var referenceTd = addressSpace.findObject(r.referenceTypeId);
        //    var obj = addressSpace.findObject(r.nodeId);
        //    return "<-- " + referenceTd.browseName.toString() + " -- " + obj.browseName.toString();
        //}
        //
        //console.log("xxxxx ========================================================".bgRed,originalObject.browseName.toString(),
        //    organizedByArray.map(dumpRef).join("\n"));
        organizedByArray.forEach(function(ref) {

            if (extraInfo.mapOrgToClone.hasOwnProperty(ref.nodeId.toString())) {

                var info = extraInfo.mapOrgToClone[ref.nodeId.toString()];
                var folder = info.original;


                assert(folder.typeDefinitionObj.browseName.name.toString() === "FunctionalGroupType");

                // now create the same reference with the instantiated function group
                 var destFolder = info.cloned;

                destFolder.addReference({
                    referenceType: ref.referenceTypeId.toString(),
                    isForward: !ref.isForward,
                    nodeId: instantiatedObject.nodeId
                });
                //xx console.log("xxx ============> adding reference ",ref.browse )
            }
        });
    });
}

function initialize_properties_and_components(topMostType,self, references,optionals) {

    var extraInfo = new CloneHelper();

    _initialize_properties_and_components(topMostType,self, references,optionals,extraInfo);

    reconstructFunctionalGroupType(extraInfo);

}

/**
 * instantiate an object of this UAVariableType
 * The instantiation takes care of object type inheritance when constructing inner properties
 * @method instantiate
 * @param options
 * @param options.browseName {String}
 * @param [options.description]
 * @param [options.organizedBy] {String|NodeId|UANode} the parent Folder holding this object
 * @param [options.componentOf] {String|NodeId|UANode} the parent Object holding this object
 * @param [options.optionals] {Array<String} array of browseName of optional component/property to instantiate.
 *
 * Note : HasComponent usage scope
 *
 *    Source          |     Destination
 * -------------------+---------------------------
 *  Object            | Object, Variable,Method
 *  ObjectType        |
 * -------------------+---------------------------
 *  DataVariable      | Variable
 *  DataVariableType  |
 *
 *
 *  see : OPCUA 1.03 page 44 $6.4 Instances of ObjectTypes and VariableTypes
 */
UAVariableType.prototype.instantiate = function (options) {

    var self = this;
    var address_space = self.__address_space;
    //xx assert(!self.isAbstract, "cannot instantiate abstract UAVariableType");

    assert(options, "missing option object");
    assert(_.isString(options.browseName), "expecting a browse name");

    assertUnusedChildBrowseName(address_space,options);

    var baseVariableType = address_space.findVariableType("BaseVariableType");
    assert(baseVariableType, "BaseVariableType must be defined in the address_space");

    var references = [];
    initialize_properties_and_components(baseVariableType,self, references,options.optionals);

    var dataType =  options.dataType ? options.dataType  : self.dataType; // may be required (i.e YArrayItemType )
    dataType = self.resolveNodeId(dataType);    // DataType (NodeId)

    assert(dataType instanceof NodeId);

    if (!dataType || dataType.isEmpty()) {
        console.log(" options.dataType" , options.dataType ? options.dataType.toString() : "<null>");
        console.log(" self.dataType" , self.dataType ? self.dataType.toString() : "<null>");
        throw new Error(" A valid dataType must be specified");
    }


    var opts = {
        browseName: options.browseName,
        description: options.description || self.description,
        references: references,

        componentOf: options.componentOf,
        organizedBy: options.organizedBy,
        dataType: dataType,
        typeDefinition: self.nodeId,

        value: options.value,

    };

    var parentObj = options.componentOf ||  options.organizedBy;
    var instance = address_space.addVariable(parentObj,opts);

    // if VariableType is a type of Structure DataType
    // we need to instantiate a dataValue
    // and create a bidirectional binding with the individual properties of this type
    instance.bindExtensionObject();


    if (instance.componentOf) {
        instance.componentOf.install_extra_properties();
    }
    if (instance.organizedBy) {
        instance.organizedBy.install_extra_properties();
    }

    assert(instance.typeDefinition.toString()=== self.nodeId.toString());

    instance.install_extra_properties();

    return instance;
};
exports.UAVariableType = UAVariableType;

