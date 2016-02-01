"use strict";

/**
 * @module opcua.address_space
 */
require("requirish")._(module);
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;

var NodeId = require("lib/datamodel/nodeid").NodeId;
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;
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


function OnlyMandatoryChildrenOrRequestedOptionals(instance,optionals,node) {


    // should we clone the node to be a component or propertof of a instnace

    assert(_.isArray(optionals));

    var addressSpace = node.__address_space;

    var references = [].concat(instance._references,instance._back_references);

    var alreadyIn = references.filter(function(r){
        var n =addressSpace.findNode(r.nodeId);
        assert(_.isObject(n) || false);
        var isAlreadyIn =n.browseName.name.toString() === node.browseName.name.toString();
        return isAlreadyIn ;
    });
    if(alreadyIn.length > 0) {
        assert(alreadyIn.length === 1, "Duplication found ?");
        // a child with the same browse name has already been install
        // probably froma SuperClass, we should ignore this.
        return false; // ignore
    }

    var modellingRule = node.modellingRule;

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


function _get_parent_as_VariableOrObjectType(originalObject) {

    var addressSpace = originalObject.__address_space;

    var parent = originalObject.findReferencesEx("HasChild",BrowseDirection.Inverse);
    if (!(parent.length ===0 || parent.length === 1)) {
        console.log(originalObject.toString());
    }
    assert(parent.length ===0 || parent.length === 1);
    if (parent.length === 0){ return null; }
    parent = addressSpace.findNode(parent[0].nodeId);
    if (parent && ( parent.nodeClass === NodeClass.VariableType || parent.nodeClass === NodeClass.ObjectType )) {
        return parent;
    }
    return null;
}
function get_childByName(node,browseName) {

    assert(node);
    var addressSpace = node.__address_space;
    var childrenRef = node.findReferencesEx("HierarchicalReferences",BrowseDirection.Forward);

    var child = _.filter(childrenRef,function(r){
        return r.browseName.toString() === browseName.toString();
    });

    if (child.length >= 1) {
        assert(child.length === 1);
        child = addressSpace.findNode(child[0].nodeId);
        return child;
    }
    return null;
}

function CloneHelper()
{
    this.mapOrgToClone = {};
}

CloneHelper.prototype.registerClonedObject = function(objInType,clonedObj) {

    //xx console.log("zzzz => ",objInType.nodeId.toString(), clonedObj.nodeId.toString());
    this.mapOrgToClone[objInType.nodeId.toString()] = {
        original: objInType,
        cloned: clonedObj
    };

    //
    //   /-----------------------------\
    //   | AcknowledgableConditionType |
    //   \-----------------------------/
    //              ^        |
    //              |        +---------------------|- (EnableState)   (shadow element)
    //              |
    //   /-----------------------------\
    //   |        AlarmConditionType   |
    //   \-----------------------------/
    //              |
    //              +-------------------------------|- EnableState    <
    //
    // find qlso child object with the same browse name that are
    // overriden in the SuperType
    //
    var origParent = _get_parent_as_VariableOrObjectType(objInType);
    if (origParent) {

        var base = origParent.subtypeOfObj;
        while(base) {
            var shadowChild = get_childByName(base,objInType.browseName);
            if(shadowChild) {
                this.mapOrgToClone[shadowChild.nodeId.toString()] = {
                    original: shadowChild,
                    cloned: clonedObj
                };
                //xx console.log("   zzzz =>     ",shadowChild.nodeId.toString(), clonedObj.nodeId.toString(),objInType.browseName.toString());
            }
            base = base.subtypeOfObj;
        }
    }
    // find subTypeOf

};

// install properties and components on a instantiate Object
//
// based on their ModelingRule
//  => Mandatory                 => Installed
//  => Optional                  => Not Installed , unless it appear in optionals array
//  => OptionalPlaceHolder       => Not Installed
//  => null (no modelling ruleà) =>  Not Installed
//
function _initialize_properties_and_components(instance,topMostType,typeNode,optionals, extraInfo) {

    optionals = optionals || [];

    var addressSpace = topMostType.__address_space;

    if (topMostType.nodeId === typeNode.nodeId) {
        return; // nothing to do
    }

    var baseTypeNodeId = typeNode.subtypeOf;
    // istanbul ignore next
    if (!baseTypeNodeId) {
        throw new Error("Object with nodeId " + typeNode.nodeId + " - "  + typeNode.browseName + " has no Type - (self.subtypeOf undefined)");
    }

    var baseType = addressSpace.findNode(baseTypeNodeId);

    // istanbul ignore next
    if (!baseType) {
        throw new Error("Cannot find object with nodeId ".red + baseTypeNodeId);
    }

    var filter = OnlyMandatoryChildrenOrRequestedOptionals.bind(null,instance,optionals);
    typeNode._clone_children_references(instance,filter,extraInfo);

    // get properties and components from base class
    _initialize_properties_and_components(instance,topMostType,baseType,optionals , extraInfo);

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
function assertUnusedChildBrowseName(addressSpace,options) {

    function resolveOptionalObject(node) {
        return  node ? addressSpace._coerceNode(node) : null;
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


function sameNodeId(n1,n2) {
    return n1.toString() === n2.toString();
}
function _remove_unwanted_ref(ref) {
    // filter out HasTypeDefinition (i=40) , HasModellingRule (i=37);
    var hasTypeDefintionNodeId = makeNodeId(40);
    var hasModellingRuleNodeId = makeNodeId(37);
    ref = _.filter(ref,function(r) {
        return !sameNodeId(r.referenceTypeId,hasTypeDefintionNodeId) &&
            !sameNodeId(r.referenceTypeId,hasModellingRuleNodeId) ; });
    return ref;
}




function findNoHierarchicalReferences(originalObject) {

    var addressSpace = originalObject.__address_space;

    var referenceId = addressSpace.findReferenceType("NonHierarchicalReferences");
    assert(referenceId);

    // we need to explore
    var references = originalObject.findReferencesEx("NonHierarchicalReferences",BrowseDirection.Inverse);


    var parent = _get_parent_as_VariableOrObjectType(originalObject);

    if (parent) {

        // parent is a ObjectType or VariableType
        assert(parent.nodeClass === NodeClass.VariableType || parent.nodeClass === NodeClass.ObjectType);

        // let investigate the same child base child
        var child = get_childByName(parent.subtypeOfObj,originalObject.browseName);

        if (child) {
            var baseRef = findNoHierarchicalReferences(child);
            ///xx console.log("  ... ",originalObject.browseName.toString(), parent.browseName.toString(), references.length, baseRef.length);
            references = [].concat(references,baseRef);

        }
    }
    // perform some cleanup
    references =  _remove_unwanted_ref(references);
    //
    //function dump(ref) {
    //    console.log("   ",
    //        addressSpace.findNode(ref.referenceTypeId).browseName.toString(),
    //        addressSpace.findNode(ref.nodeId).browseName.toString(),ref.nodeId.toString() )
    //}
    //references.forEach(dump);

    return references;

}

function reconstructNonHierachicalReferences(extraInfo) {

    // navigate through original objects to find those that are being organized by some FunctionalGroup
    _.forEach(extraInfo.mapOrgToClone,function(value,key) {

        var originalObject     = value.original;
        var clonedObject       = value.cloned;
        var addressSpace       = originalObject.__address_space;

        // find no Hierarchical References on original object
        var originalNonHierarchical = findNoHierarchicalReferences(originalObject);

        //xx originalNonHierarchical =  _remove_unwanted_ref(originalNonHierarchical);

        if(originalNonHierarchical.length === 0 ){
            return;
        }

        function findImplementedObject(ref) {
            var info  = extraInfo.mapOrgToClone[ref.nodeId.toString()];
            if (info) {
                return info;
            }
            return null;
        }
        originalNonHierarchical.forEach(function(ref) {

            var info =findImplementedObject(ref);
            if (info) {

                var originalDest = info.original;
                var cloneDest    = info.cloned;

                //xx console.log("   adding reference ".cyan ,addressSpace.findNode(ref.referenceTypeId).browseName.toString() , " from ",
                //xxx    clonedObject.nodeId.toString(),clonedObject.browseName.toString(),
                //xx    " to ", cloneDest.nodeId.toString(),cloneDest.browseName.toString() );

                // restore reference
                clonedObject.addReference({
                    referenceType: ref.referenceTypeId,
                    isForward: false,
                    nodeId: cloneDest.nodeId
                });
            }
        });
    });
}

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
    // navigate through original objects to find those that are being organized by some FunctionalGroup
    _.forEach(extraInfo.mapOrgToClone,function(value,key){

        var originalObject = value.original;
        var instantiatedObject = value.cloned;
        var organizedByArray = originalObject.findReferencesEx("Organizes",BrowseDirection.Inverse);


        var addressSpace = originalObject.__address_space;

        //function dumpRef(r) {
        //    var referenceTd = addressSpace.findNode(r.referenceTypeId);
        //    var obj = addressSpace.findNode(r.nodeId);
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

                assert(ref.referenceTypeId);

                destFolder.addReference({
                    referenceType: ref.referenceTypeId,
                    isForward: !ref.isForward,
                    nodeId: instantiatedObject.nodeId
                });
                //xx console.log("xxx ============> adding reference ",ref.browse )
            }
        });
    });
}

function initialize_properties_and_components(instance,topMostType,nodeType,optionals) {

    var extraInfo = new CloneHelper();

    _initialize_properties_and_components(instance,topMostType,nodeType,optionals,extraInfo);

    reconstructFunctionalGroupType(extraInfo);

    reconstructNonHierachicalReferences(extraInfo);

}

/**
 * instantiate an object of this UAVariableType
 * The instantiation takes care of object type inheritance when constructing inner properties
 * @method instantiate
 * @param options
 * @param options.browseName {String}
 * @param [options.description]
 * @param [options.organizedBy]   {String|NodeId|BaseNode} the parent Folder holding this object
 * @param [options.componentOf]   {String|NodeId|BaseNode} the parent Object holding this object
 * @param [options.optionals]     {Array<String>} array of browseName of optional component/property to instantiate.
 * @param [options.modellingRule] {String}
 * @param [options.minimumSamplingInterval =0] {Number}
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
    var addressSpace = self.__address_space;
    //xx assert(!self.isAbstract, "cannot instantiate abstract UAVariableType");

    assert(options, "missing option object");
    assert(_.isString(options.browseName), "expecting a browse name");

    assertUnusedChildBrowseName(addressSpace,options);

    var baseVariableType = addressSpace.findVariableType("BaseVariableType");
    assert(baseVariableType, "BaseVariableType must be defined in the address space");

    var dataType =  options.dataType ? options.dataType  : self.dataType; // may be required (i.e YArrayItemType )
    dataType = self.resolveNodeId(dataType);    // DataType (NodeId)
    assert(dataType instanceof NodeId);
    if (!dataType || dataType.isEmpty()) {
        console.log(" options.dataType" , options.dataType ? options.dataType.toString() : "<null>");
        console.log(" self.dataType" , self.dataType ? self.dataType.toString() : "<null>");
        throw new Error(" A valid dataType must be specified");
    }

    var opts = {
        browseName:     options.browseName,
        description:    options.description || self.description,
        componentOf:    options.componentOf,
        organizedBy:    options.organizedBy,
        typeDefinition: self.nodeId,
        nodeId:         options.nodeId,
        dataType:       dataType,
        value:          options.value,
        modellingRule : options.modellingRule,
        minimumSamplingInterval: options.minimumSamplingInterval
    };

    var instance = addressSpace.addVariable(opts);


    initialize_properties_and_components(instance,baseVariableType,self,options.optionals);

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

