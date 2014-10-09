/**
 * @module opcua.address_space
 */

var NodeClass = require("./../datamodel/nodeclass").NodeClass;
var NodeId = require("../datamodel/nodeid").NodeId;
var makeNodeId  = require("../datamodel/nodeid").makeNodeId;
var resolveNodeId = require("../datamodel/nodeid").resolveNodeId;
var s = require("../datamodel/structures");


var DataValue = require("../datamodel/datavalue").DataValue;
var Variant = require("../datamodel/variant").Variant;
var DataType = require("../datamodel/variant").DataType;
var StatusCodes = require("../datamodel/opcua_status_code").StatusCodes;
var read_service = require("../services/read_service");
var AttributeIds = read_service.AttributeIds;

var browse_service = require("../services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

var assert  = require("better-assert");
var util = require("util");
var _ = require("underscore");
var dumpIf = require("../misc/utils").dumpIf;


var BaseNode = require("./basenode").BaseNode;
var ReferenceType= require("./referenceType").ReferenceType;
var Variable = require("./variable").Variable;
var VariableType = require("./variableType").VariableType;
var ObjectType = require("./objectType").ObjectType;
var BaseObject = require("./baseObject").BaseObject;
var Method = require("./method").Method;
var UADataType = require("./data_type").UADataType;

var _constructors = {};

function registerConstructor(ConstructorFunc, nodeId) {
    ConstructorFunc.prototype.typeDefinition = resolveNodeId(nodeId+"Node");
    _constructors[ConstructorFunc.prototype.typeDefinition.toString()] = ConstructorFunc;
}
registerConstructor(Variable, "VariableType");


/**
 * @class View
 * @extends  BaseNode
 * @param options
 * @constructor
 */
function View(options) {
    BaseNode.apply(this, arguments);
    this.containsNoLoops = options.containsNoLoops ? true : false;
    this.eventNotifier = 0;
}
util.inherits(View, BaseNode);
View.prototype.nodeClass = NodeClass.View;

/**
 * @method readAttribute
 * @param attributeId
 * @return {DataValue}
 */
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




/**
 * @class AddressSpace
 * @constructor
 */
function AddressSpace() {
    this._nodeid_index = {};
    this._aliases = {};
    this._objectTypeMap = {};
    this._objectMap = {};
    this._variableTypeMap = {};
    this._referenceTypeMap = {};
    this._referenceTypeMapInv = {};
    this._dataTypeMap = {};
    this._methodMap = {};
}

/**
 *
 * @method add_alias
 * @param alias_name {String} the alias name
 * @param nodeId {NodeId}
 */
AddressSpace.prototype.add_alias = function(alias_name,nodeId) {
    assert(typeof alias_name === "string");
    assert(nodeId instanceof NodeId);
    this._aliases[alias_name] = nodeId;
};

/**
 * find an object by node Id
 * @method findObject
 * @param nodeId {NodeId|String}  a nodeId or a string coerce-able to nodeID, representing the object to find.
 * @return {BaseNode}
 */
AddressSpace.prototype.findObject = function (nodeId) {
    nodeId = this.resolveNodeId(nodeId);
    return this._nodeid_index[nodeId.toString()];
};

/**
 *
 * @method findObjectByBrowseName
 * @param browseNameToFind {String}
 * @return {BaseNode}
 */
AddressSpace.prototype.findObjectByBrowseName = function(browseNameToFind) {
    return this._objectMap[browseNameToFind];
};

AddressSpace.prototype._register = function (object) {

    assert(object.nodeId instanceof NodeId);
    assert(object.nodeId);
    assert(object.hasOwnProperty("browseName"));

    var indexName = object.nodeId.toString();
    if (this._nodeid_index.hasOwnProperty(indexName)) {
        throw new Error("nodeId "  + object.nodeId.displayText() +  " already registered " + object.nodeId.toString() )
    }

    this._nodeid_index[indexName] = object;


    if (object.nodeClass === NodeClass.ObjectType) {
        this._objectTypeMap[object.browseName] = object;

    } else if (object.nodeClass === NodeClass.VariableType) {
        this._variableTypeMap[object.browseName] = object;

    } else if (object.nodeClass === NodeClass.Object) {
        this._objectMap[object.browseName] = object;

    } else if (object.nodeClass === NodeClass.Variable) {
       //xx console.log("add variable",object.browseName , object.nodeId.toString());
       this._objectMap[object.browseName] = object;

    } else if (object.nodeClass === NodeClass.ReferenceType) {
        assert(object.inverseName.text);
        this._referenceTypeMap[object.browseName] = object;
        this._referenceTypeMapInv[object.inverseName.text] = object;

    } else if (object.nodeClass === NodeClass.DataType) {
        this._dataTypeMap[object.browseName] = object;

    } else if (object.nodeClass === NodeClass.Method) {
        this._methodMap[object.browseName] = object;

    } else {
        console.log("Invalid class Name" , object.nodeClass);
        throw new Error("Invalid class name specified");
    }

};

/**
 * resolved a string or a nodeId to a nodeID
 *
 * @method resolveNodeId
 * @param nodeid {NodeId|String}
 * @return {NodeId}
 */
AddressSpace.prototype.resolveNodeId = function (nodeid) {

    if (typeof nodeid === "string") {
        // check if the string is a known alias
        var alias = this._aliases[nodeid];
        if (alias !== undefined) {
          return alias;
        }
    }
    return resolveNodeId(nodeid);
};

var _constructors_map = {
    "Object":            BaseObject,
    "ObjectType":        ObjectType,
    "ReferenceType":     ReferenceType,
    "Variable"     :     Variable,
    "VariableType":      VariableType,
    "DataType":          UADataType,
    "Method":            Method
};

/**
 * @method _createObject
 * @private
 * @param options
 *
 * @param options.nodeId   {NodeId}
 * @param options.nodeClass
 * @param options.browseName {String}
 * @return {constructor}
 * @private
 */
AddressSpace.prototype._createObject = function(options) {


    dumpIf(!options.nodeId,options); // missing node Id
    assert(options.nodeId);
    assert(options.nodeClass);
    assert(typeof options.browseName === "string");

    var constructor = _constructors_map[options.nodeClass.key];
    if (!constructor) {
        throw new Error(" missing constructor for NodeClass " + options.nodeClass.key);
    }

    options.address_space = this;
    var obj = new constructor(options);
    assert(obj.nodeId);
    assert(obj.nodeId instanceof NodeId);
    this._register(obj);

    //xx console.log("full_name" ,obj.full_name());
    //xx assert(this.findObjectByBrowseName(obj.full_name()) === obj);

    // object shall now be registered
    // xxassert(_.isObject(this.findObject(obj.nodeId) && " Where is object ?");
    return obj;
};


/**
 * browse some path.
 *
 * @method browsePath
 * @param  {BrowsePath} browsePath
 * @return {BrowsePathResult}
 *
 * This service can be used translates one or more browse paths into NodeIds.
 * A browse path is constructed of a starting Node and a RelativePath. The specified starting Node
 * identifies the Node from which the RelativePath is based. The RelativePath contains a sequence of
 * ReferenceTypes and BrowseNames.
 *
 *   |StatusCode                    |                                                            |
 *   |------------------------------|:-----------------------------------------------------------|
 *   |BadNodeIdUnknown              |                                                            |
 *   |BadNodeIdInvalid              |                                                            |
 *   |BadNothingToDo                | - the relative path contains an empty list )               |
 *   |BadBrowseNameInvalid          | - target name is missing in relative path                  |
 *   |UncertainReferenceOutOfServer | - The path element has targets which are in another server.|
 *   |BadTooManyMatches             |                                                            |
 *   |BadQueryTooComplex            |                                                            |
 *   |BadNoMatch                    |                                                            |
 *
 *
 */
AddressSpace.prototype.browsePath = function(browsePath) {

    var self = this;

    var translate_service = require("../services/translate_browse_paths_to_node_ids_service");
    var BrowsePathResult =translate_service.BrowsePathResult;

    assert(browsePath instanceof translate_service.BrowsePath);

    var startingNode = self.findObject(browsePath.startingNode);
    if (!startingNode) {
        return new BrowsePathResult({statusCode: StatusCodes.BadNodeIdUnknown});
    }

    if(browsePath.relativePath.elements.length === 0 ) {
        return new BrowsePathResult({statusCode: StatusCodes.BadNothingToDo});
    }

    // The last element in the relativePath shall always have a targetName specified.
    var l = browsePath.relativePath.elements.length;
    var last_el = browsePath.relativePath.elements[l-1];

    if (!last_el.targetName || !last_el.targetName.name || last_el.targetName.name.length === 0) {
        return new BrowsePathResult({statusCode: StatusCodes.BadBrowseNameInvalid});
    }

    var res =[];
    function explore_element(curNodeObject,elements,index) {

        var element = elements[index];
        assert(element instanceof translate_service.RelativePathElement);

        var nodeIds = curNodeObject.browseNodeByTargetName(element);

        var targets = [];
        nodeIds.forEach(function(nodeId){
            targets.push({
                targetId: nodeId,
                remainingPathIndex: elements.length - index
            });
        });
        var is_last =( (index+1) ===  elements.length);

        if (!is_last) {
            // explorer
            targets.forEach(function(target){
                var node = self.findObject(target.targetId);
                explore_element(node,elements,index+1);
            });
        } else {
            targets.forEach(function(target){
                res.push({
                    targetId: target.targetId,
                    remainingPathIndex: 0xFFFFFFFF
                });
            });
        }
    }
    explore_element(startingNode, browsePath.relativePath.elements,0);

    if (res.length === 0 ) {
        return  new BrowsePathResult({ statusCode: StatusCodes.BadNoMatch});
    }

    var browsePathResult = new BrowsePathResult({
        statusCode : StatusCodes.Good,
        targets: res
    });
    return browsePathResult;
};

var rootFolderId = makeNodeId(84); // RootFolder


/**
 * convert a path string to a BrowsePath
 *
 * @method constructBrowsePath
 * @param startingNode {NodeId|string}
 * @param path {string} path such as Objects.Server
 * @return {BrowsePath}
 *
 * @example:
 *
 *   ```javascript
 *   constructBrowsePath("/","Objects");
 *   constructBrowsePath("/","Objects.Server");
 *   constructBrowsePath("/","Objects.4:Boilers");
 *   ```
 *
 *  - '#' : HasSubtype
 *  - '.' : Organizes , HasProperty, HasComponent, HasNotifier
 *  - '&' : HasTypeDefinition
 *
 */
function constructBrowsePath(startingNode ,path) {

    if (startingNode === "/" ) {
        startingNode = rootFolderId;
    }
    var translate_service = require("../services/translate_browse_paths_to_node_ids_service");

    var arr = path.split(".");
    var elements = arr.map(function(browsePathElement){

        // handle browsePathElement with namespace indexes
        var s = browsePathElement.split(":");
        var namespaceIndex=0;
        if (s.length === 2) {
            namespaceIndex = parseInt(s[0]);
            browsePathElement = s[1];
        }

        return {
            referenceTypeId: makeNodeId(0),
            isInverse: false,
            includeSubtypes: false,
            targetName: { namespaceIndex:namespaceIndex, name: browsePathElement}
        };
    });

    var browsePath = new translate_service.BrowsePath({
        startingNode: rootFolderId, // ROOT
        relativePath: {
            elements: elements
        }
    });
    return browsePath;
}
exports.constructBrowsePath = constructBrowsePath;

/**
 * a simplified version of browsePath that takes a path as a string
 * and returns a single node or null if not found.
 * @method simpleBrowsePath
 * @param startingNode
 * @param pathname
 * @return {BrowsePathTarget}
 */
AddressSpace.prototype.simpleBrowsePath = function(startingNode,pathname) {
    var browsePath = constructBrowsePath(startingNode,pathname);
    var browsePathResult = this.browsePath(browsePath);
    if (browsePathResult.statusCode !== StatusCodes.Good) {
        return null; // not found
    } else {
        assert(browsePathResult.targets.length >= 1);
        browsePathResult.targets[browsePathResult.targets.length-1].remainingPathIndex.should.equal(0xFFFFFFFF);
        return browsePathResult.targets[browsePathResult.targets.length-1].targetId;
    }
};


AddressSpace.prototype.findDataType = function(browseName) {
   // startingNode i=24  :
   // BaseDataType
   // +-> Boolean (i=1) {BooleanDataType (ns=2:9898)
   // +-> String (i=12)
   //     +->NumericRange
   //     +->Time
   // +-> DateTime
   // +-> Structure
   //       +-> Node
   //            +-> ObjectNode
  return this._dataTypeMap[browseName];
};

AddressSpace.prototype.findObjectType = function(browseName){
    return this._objectTypeMap[browseName];
};
AddressSpace.prototype.findVariableType = function(browseName){
    return this._variableTypeMap[browseName];
};

/**
 * @method findReferenceType
 * @param refType {String}
 * @return {ReferenceType|null}
 *
 * refType could be
 *    a string representing a nodeid       : e.g.    'i=9004'
 *    a string representing a browse name  : e.g     'HasTypeDefinition'
 *      in this case it should be in the alias list
 *
 */
AddressSpace.prototype.findReferenceType = function(refType) {
    // startingNode ns=0;i=31 : References
    //  References i=31
    //  +->(hasSubtype) NoHierarchicalReferences
    //                  +->(hasSubtype) HasTypeDefinition
    //  +->(hasSubtype) HierarchicalReferences
    //                  +->(hasSubtype) HasChild/ChildOf
    //                                  +->(hasSubtype) Aggregates/AggregatedBy
    //                                                  +-> HasProperty/PropertyOf
    //                                                  +-> HasComponent/ComponentOf
    //                                                  +-> HasHistoricalConfiguration/HistoricalConfigurationOf
    //                                 +->(hasSubtype) HasSubtype/HasSupertype
    //                  +->(hasSubtype) Organizes/OrganizedBy
    //                  +->(hasSubtype) HasEventSource/EventSourceOf
    var object,nodeId;

    if ( refType.substring(0,2) === "i=") {
        nodeId = resolveNodeId(refType);
        object = this.findObject(nodeId);
        //xx console.log("object",nodeId,object);
        assert(object&& (object.nodeClass === NodeClass.ReferenceType) );
    } else {
        object = this._referenceTypeMap[refType];
        assert(!object || (object.nodeClass === NodeClass.ReferenceType && object.browseName === refType) );
    }
    return object;
};

/**
 * find a ReferenceType by its inverse name.
 * @method findReferenceTypeFromInverseName
 * @param inverseName {String} the inverse name of the ReferenceType to find
 * @return {ReferenceType}
 */
AddressSpace.prototype.findReferenceTypeFromInverseName = function(inverseName) {

    var object = this._referenceTypeMapInv[inverseName];
    assert(!object || (object.nodeClass === NodeClass.ReferenceType && object.inverseName.text === inverseName) );
    return object;
};

/**
 * @method normalizeReferenceType
 * @param params.referenceType  {String}
 * @param params.isForward  {Boolean} default value: true;
 * @return { referenceType: <value>, isFoward: <flag>} a new object with the normalized name
 */
AddressSpace.prototype.normalizeReferenceType = function(params) {
    // referenceType = Organizes   , isForward = true =>   referenceType = Organizes ,   isForward = true
    // referenceType = Organizes   , isForward = false =>  referenceType = Organizes ,   isForward = false
    // referenceType = OrganizedBy , isForward = true =>   referenceType = Organizes , isForward = **false**
    // referenceType = OrganizedBy , isForward = false =>  referenceType = Organizes , isForward =  **true**


    assert(typeof params.referenceType === "string");
    params.isForward = ( params.isForward === null ) ? true : params.isForward;

    var n1 = this.findReferenceType(params.referenceType);
    var n2 = this.findReferenceTypeFromInverseName(params.referenceType);

    if (!n1 && !n2) {
        // unknown type, there is nothing we can do about it
        return params;
    } else   if (n1) {
        assert(!n2);
        return params;
    } else {
        assert(n2);
        // make sure we preserve integrity of object passed as a argument
        var new_params = _.clone(params);
        new_params.referenceType= n2.browseName;
        new_params.isForward = ! params.isForward;
        return new_params;
    }
};

/**
 * returns the inverse name of the referenceType.
 *
 * @method inverseReferenceType
 * @param referenceType {String} : the reference type name
 * @return {String} the name of the inverse reference type.
 *
 * @example
 *
 *    ```javascript
 *    address_space.inverseReferenceType("OrganizedBy").should.eql("Organizes");
 *    address_space.inverseReferenceType("Organizes").should.eql("OrganizedBy");
 *    ```
 *
 */
AddressSpace.prototype.inverseReferenceType = function(referenceType) {

    assert( typeof referenceType === "string");

    var n1 = this.findReferenceType(referenceType);
    var n2 = this.findReferenceTypeFromInverseName(referenceType);
    if (n1) {
        assert(!n2);
        return n1.inverseName.text;
    } else {
        assert(n2);
        return n2.browseName;
    }
};

exports.AddressSpace = AddressSpace;
