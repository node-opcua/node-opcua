"use strict";

/**
 * @module opcua.address_space
 */
var assert = require("node-opcua-assert");
var util = require("util");
var _ = require("underscore");

var NodeClass = require("node-opcua-data-model").NodeClass;

var NodeId = require("node-opcua-nodeid").NodeId;
var coerceNodeId = require("node-opcua-nodeid").coerceNodeId;
var makeNodeId = require("node-opcua-nodeid").makeNodeId;
var resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
var sameNodeId = require("node-opcua-nodeid").sameNodeId;


var DataValue =  require("node-opcua-data-value").DataValue;

var Variant  = require("node-opcua-variant").Variant;
var DataType = require("node-opcua-variant").DataType;
var VariantArrayType = require("node-opcua-variant").VariantArrayType;

var StatusCodes = require("node-opcua-status-code").StatusCodes;

var AttributeIds = require("node-opcua-data-model").AttributeIds;


var isNullOrUndefined = require("node-opcua-utils").isNullOrUndefined;


var BrowseDirection = require("node-opcua-data-model").BrowseDirection;

var SessionContext = require("./session_context").SessionContext;
var Reference = require("./reference").Reference;


var debug =  require("node-opcua-debug");
var debugLog = debug.make_debugLog(__filename);
var doDebug = debug.checkDebugFlag(__filename);



var BaseNode = require("./base_node").BaseNode;


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

    var self = this;

    BaseNode.apply(self, arguments);

    self.isAbstract = isNullOrUndefined(options.isAbstract) ? false : options.isAbstract;

    self.value = options.value;          // optional default value for instances of this UAVariableType

    self.dataType = prepareDataType(options.dataType);    // DataType (NodeId)

    self.valueRank = options.valueRank || 0;  // Int32

    // see OPC-UA part 5 : $3.7 Conventions for Node descriptions
    self.arrayDimensions = options.arrayDimensions || [];

    assert(_.isArray(this.arrayDimensions));

    if (options.value) {
        self.value = new Variant(options.value);
        //xx console.log("setting ",self.value.toString());
    }
}

util.inherits(UAVariableType, BaseNode);
UAVariableType.prototype.nodeClass = NodeClass.VariableType;

UAVariableType.prototype.readAttribute = function (context, attributeId) {

    assert(context instanceof SessionContext);

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
                debugLog(" warning Value not implemented");
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
            return BaseNode.prototype.readAttribute.call(this, context, attributeId);
    }
    return new DataValue(options);
};


var tools = require("./tool_isSupertypeOf");
UAVariableType.prototype.isSupertypeOf = tools.construct_isSupertypeOf(UAVariableType);


/**
 * return true if node is a mandatory child or a requested optional
 * @param instance
 * @param optionalsMap
 * @return {Boolean}
 */
function MandatoryChildOrRequestedOptionalFilter(instance, optionalsMap) {
    var self = this;
    // should we clone the node to be a component or propertyOf of a instance
    assert(_.isObject(optionalsMap));
    assert(null !== instance);
    self.optionalsMap= optionalsMap;
    self.instance = instance;
    self.references = [].concat(_.map(
        instance._referenceIdx), _.map(instance._back_referenceIdx));

}

MandatoryChildOrRequestedOptionalFilter.prototype.shouldKeep = function(node)
{
    var self = this;

    var addressSpace = node.addressSpace;

    var alreadyIn = self.references.filter(function (r) {
        var n = addressSpace.findNode(r.nodeId);
        if (!_.isObject(n)) {
            console.log(" cannot find node ",r.nodeId.toString());
        }
        assert(_.isObject(n) || false);
        return n.browseName.name.toString() === node.browseName.name.toString();
    });

    if (alreadyIn.length > 0) {
        assert(alreadyIn.length === 1, "Duplication found ?");
        // a child with the same browse name has already been install
        // probably from a SuperClass, we should ignore this.
        return false; // ignore
    }

    var modellingRule = node.modellingRule;

    switch (modellingRule) {
        case null:
            return false; // skip
        case "Mandatory":
            return true;  // keep;
        case "Optional":
            // only if in requested optionals
            return (node.browseName.name in self.optionalsMap);
            break;
        case "OptionalPlaceHolder":
            return false; // ignored
        default:
            return false; // ignored
    }
};
MandatoryChildOrRequestedOptionalFilter.prototype.filterFor = function(childinstance)
{
    // construct
    var self = this;

    var browseName =childinstance.browseName.name;

    var map = {};

    if (browseName in self.optionalsMap) {
        map = self.optionalsMap[browseName];
    }
    var newFilter=  new MandatoryChildOrRequestedOptionalFilter(childinstance,map);
    return newFilter;
};




/*
 * @function _get_parent_as_VariableOrObjectType
 * @param originalObject
 * @return {null|UABaseNode}
 * @private
 */
function _get_parent_as_VariableOrObjectType(originalObject) {

    if (originalObject.nodeClass === NodeClass.Method) {
        return null;
    }

    var addressSpace = originalObject.addressSpace;

    var parent = originalObject.findReferencesEx("HasChild",BrowseDirection.Inverse);

    // istanbul ignore next
    if (parent.length > 1) {
        console.warn(" object ", originalObject.browseName.toString(), " has more than one parent !");
        console.warn(originalObject.toString());
        console.warn(" parents : ");
        for (var i = 0; i < parent.length; i++) {
            console.log("     ",
              parent[i].toString(),
              addressSpace.findNode(parent[i].nodeId).browseName.toString()
            );
        }
        return null;
    }

    assert(parent.length ===0 || parent.length === 1);
    if (parent.length === 0){ return null; }
    parent = addressSpace.findNode(parent[0].nodeId);
    if (parent && ( parent.nodeClass === NodeClass.VariableType || parent.nodeClass === NodeClass.ObjectType )) {
        return parent;
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
    //              |        +---------------------|- (EnabledState)   (shadow element)
    //              |
    //   /-----------------------------\
    //   |        AlarmConditionType   |
    //   \-----------------------------/
    //              |
    //              +-------------------------------|- EnabledState    <
    //
    // find also child object with the same browse name that are
    // overridden in the SuperType
    //
    var origParent = _get_parent_as_VariableOrObjectType(objInType);
    if (origParent) {

        var base = origParent.subtypeOfObj;
        while(base) {
            var shadowChild = base.getChildByName(objInType.browseName);
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

// install properties and components on a instantiated Object
//
// based on their ModelingRule
//  => Mandatory                 => Installed
//  => Optional                  => Not Installed , unless it appear in optionals array
//  => OptionalPlaceHolder       => Not Installed
//  => null (no modelling rule ) => Not Installed
//
function _initialize_properties_and_components(instance,topMostType,typeNode,optionalsMap, extraInfo) {

    optionalsMap = optionalsMap || {};

    if (topMostType.nodeId === typeNode.nodeId) {
        return; // nothing to do
    }

    var baseTypeNodeId = typeNode.subtypeOf;

    var baseType = typeNode.subtypeOfObj;

    // istanbul ignore next
    if (!baseType) {
        throw new Error("Cannot find object with nodeId ".red + baseTypeNodeId);
    }

    var filter = new MandatoryChildOrRequestedOptionalFilter(instance,optionalsMap);


    typeNode._clone_children_references(instance,filter,extraInfo);

    // get properties and components from base class
    _initialize_properties_and_components(instance,topMostType,baseType,optionalsMap , extraInfo);

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

    // istanbul ignore next
    // verify that no components already exists in parent
    if( parent && hasChildWithBrowseName(parent,options.browseName)){
        throw new Error("object " + parent.browseName.name.toString() +
            " have already a child with browseName " + options.browseName.toString());
    }

}
exports.assertUnusedChildBrowseName = assertUnusedChildBrowseName;
exports.initialize_properties_and_components = initialize_properties_and_components;

//xx var hasTypeDefintionNodeId = makeNodeId(40);
//xx var hasModellingRuleNodeId = makeNodeId(37);
function _remove_unwanted_ref(references) {
    // filter out HasTypeDefinition (i=40) , HasModellingRule (i=37);
    references = _.filter(references,function(reference) {
        assert(reference instanceof Reference);
        return reference.referenceType !== "HasTypeDefinition"  &&
               reference.referenceType !== "HasModellingRule" ;
    });
    return references;
}


// todo: MEMOIZE this method
function findNoHierarchicalReferences(originalObject) {

    var addressSpace = originalObject.addressSpace;

    var referenceId = addressSpace.findReferenceType("NonHierarchicalReferences");
    if (!referenceId) { return []; }
    assert(referenceId);

    // we need to explore
    var references = originalObject.findReferencesEx("NonHierarchicalReferences",BrowseDirection.Inverse);
        
    //xx references = [].concat(references,originalObject.findReferencesEx("NonHierarchicalReferences",BrowseDirection.Forward));
    references = [].concat(references,originalObject.findReferencesEx("HasEventSource",BrowseDirection.Inverse));

    var parent = _get_parent_as_VariableOrObjectType(originalObject);

    if (parent && parent.subtypeOfObj) {

        // parent is a ObjectType or VariableType and is not a root type
        assert(parent.nodeClass === NodeClass.VariableType || parent.nodeClass === NodeClass.ObjectType);

        // let investigate the same child base child
        var child = parent.subtypeOfObj.getChildByName(originalObject.browseName);

        if (child) {
            var baseRef = findNoHierarchicalReferences(child);
            //xx console.log("  ... ",originalObject.browseName.toString(), parent.browseName.toString(), references.length, baseRef.length);
            references = [].concat(references,baseRef);
        }
    }
    // perform some cleanup
    references =  _remove_unwanted_ref(references);

    return references;

}

function reconstructNonHierarchicalReferences(extraInfo) {

    function findImplementedObject(ref) {
        var info  = extraInfo.mapOrgToClone[ref.nodeId.toString()];
        if (info) {
            return info;
        }
        return null;
    }

    // navigate through original objects to find those that are being references by node that
    // have been cloned .
    // this could be node organized by some FunctionalGroup
    //
    _.forEach(extraInfo.mapOrgToClone,function(value,key) {


        var originalObject     = value.original;
        var clonedObject       = value.cloned;

        // find NoHierarchical References on original object
        var originalNonHierarchical = findNoHierarchicalReferences(originalObject);

        if(originalNonHierarchical.length === 0 ){
            return;
        }

        // istanbul ignore next
        if (doDebug) {
            debugLog( " investigation ", value.original.browseName.toString() , value.cloned.nodeClass.toString(),value.original.nodeClass.toString(),value.original.nodeId.toString(),value.cloned.nodeId.toString());
        }

        originalNonHierarchical.forEach(function(ref) {

            var info =findImplementedObject(ref);

            // if the object pointed by this reference is also cloned ...
            if (info) {

                var originalDest = info.original;
                var cloneDest    = info.cloned;

                // istanbul ignore next
                if (doDebug) {
                    debugLog("   adding reference ".cyan ,ref.referenceType , " from cloned ",
                                clonedObject.nodeId.toString(),clonedObject.browseName.toString(),
                                " to cloned ", cloneDest.nodeId.toString(),cloneDest.browseName.toString() );
                }

                // restore reference
                clonedObject.addReference({
                    referenceType: ref.referenceType,
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

                assert(ref.referenceType);

                destFolder.addReference({
                    referenceType: ref.referenceType,
                    isForward: !ref.isForward,
                    nodeId: instantiatedObject.nodeId
                });
                //xx console.log("xxx ============> adding reference ",ref.browse )
            }
        });
    });
}

var makeOptionalsMap = require("./make_optionals_map").makeOptionalsMap;
function initialize_properties_and_components(instance,topMostType,nodeType,optionals) {

    var extraInfo = new CloneHelper();

    extraInfo.registerClonedObject(nodeType,instance);


    var optionalsMap = makeOptionalsMap(optionals);
    
    _initialize_properties_and_components(instance,topMostType,nodeType,optionalsMap,extraInfo);

    reconstructFunctionalGroupType(extraInfo);

    reconstructNonHierarchicalReferences(extraInfo);

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
 * @param [options.notifierOf] {NodeId|UANode}
 * @param [options.eventSourceOf] {NodeId|UANode}
 * @param [options.optionals]     {Array<String>} array of browseName of optional component/property to instantiate.
 * @param [options.modellingRule] {String}
 * @param [options.minimumSamplingInterval =0] {Number}
 * @param [options.extensionObject =null]
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
    var addressSpace = self.addressSpace;
    //xx assert(!self.isAbstract, "cannot instantiate abstract UAVariableType");

    assert(options, "missing option object");
    assert(_.isString(options.browseName), "expecting a browse name");
    assert(!options.hasOwnProperty("propertyOf"),"Use addressSpace#addVariable({ propertyOf: xxx}); to add a property");

    assertUnusedChildBrowseName(addressSpace,options);

    var baseVariableType = addressSpace.findVariableType("BaseVariableType");
    assert(baseVariableType, "BaseVariableType must be defined in the address space");

    var dataType =  (options.dataType !== undefined )? options.dataType  : self.dataType; // may be required (i.e YArrayItemType )
    dataType = self.resolveNodeId(dataType);    // DataType (NodeId)
    assert(dataType instanceof NodeId);

    var valueRank      = (options.valueRank !== undefined) ? options.valueRank : self.valueRank ;
    var arrayDimensions = (options.arrayDimensions !== undefined) ? options.arrayDimensions : self.arrayDimensions ;

    // istanbul ignore next
    if (!dataType || dataType.isEmpty()) {
        console.warn(" options.dataType" , options.dataType ? options.dataType.toString() : "<null>");
        console.warn(" self.dataType" , self.dataType ? self.dataType.toString() : "<null>");
        throw new Error(" A valid dataType must be specified");
    }


    var opts = {
        browseName:     options.browseName,
        description:    options.description || self.description,
        componentOf:    options.componentOf,
        organizedBy:    options.organizedBy,
        notifierOf:     options.notifierOf,
        eventSourceOf:  options.eventSourceOf,
        typeDefinition: self.nodeId,
        nodeId:         options.nodeId,
        dataType:       dataType,
        valueRank:      valueRank,
        arrayDimensions: arrayDimensions,
        value:          options.value,
        modellingRule : options.modellingRule,
        minimumSamplingInterval: options.minimumSamplingInterval
    };

    var instance = addressSpace.addVariable(opts);

    //xx assert(instance.minimumSamplingInterval === options.minimumSamplingInterval);

    initialize_properties_and_components(instance,baseVariableType,self,options.optionals);

    // if VariableType is a type of Structure DataType
    // we need to instantiate a dataValue
    // and create a bidirectional binding with the individual properties of this type
    instance.bindExtensionObject(options.extensionObject);


    assert(instance.typeDefinition.toString()=== self.nodeId.toString());

    instance.install_extra_properties();
    
    if (self._postInstantiateFunc) {
        self._postInstantiateFunc(instance,self);
    }

    return instance;
};
exports.UAVariableType = UAVariableType;

