
var NodeClass = require("../../lib/browse_service").NodeClass;
var NodeId = require("../../lib/nodeid").NodeId;
var makeNodeId  = require("../../lib/nodeid").makeNodeId;
var resolveNodeId = require("../../lib/nodeid").resolveNodeId;
var s = require("../../lib/structures");


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
var dumpIf = require("../utils").dumpIf;


var BaseNode = require("./basenode").BaseNode;
var ReferenceType= require("./referenceType").ReferenceType;
var Variable = require("./variable").Variable;
var VariableType = require("./variableType").VariableType;
var ObjectType = require("./objectType").ObjectType;
var BaseObject = require("./baseObject").BaseObject;

var _constructors = {};

function registerConstructor(ConstructorFunc, nodeId) {
    ConstructorFunc.prototype.typeDefinition = resolveNodeId(nodeId);
    _constructors[ConstructorFunc.prototype.typeDefinition.toString()] = ConstructorFunc;
}
registerConstructor(Variable, "VariableType");

/**
 * @param options
 * @constructor
 */
function UADataType(options) {
    BaseNode.apply(this, arguments);
}

util.inherits(UADataType, BaseNode);
UADataType.prototype.nodeClass = NodeClass.DataType;


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
    this._aliases = {};
    this._objectTypeMap = {};
    this._objectMap = {};
    this._variableTypeMap = {};
    this._referenceTypeMap = {};
    this._dataTypeMap = {};
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
};


/**
 * find an object by node Id
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
    return this._objectMap[browseNameToFind];
};

AddressSpace.prototype._register = function (object) {

    assert(object.nodeId);
    assert(object.hasOwnProperty("browseName"));

    assert(!this._nodeid_index.hasOwnProperty(object.nodeId.toString()), " nodeId already registered");

    this._nodeid_index[object.nodeId.toString()] = object;

    if (object.nodeClass === NodeClass.ObjectType) {
        this._objectTypeMap[object.browseName] = object;
    } else if (object.nodeClass === NodeClass.VariableType) {
        this._variableTypeMap[object.browseName] = object;
    } else if (object.nodeClass === NodeClass.Object) {
        this._objectMap[object.browseName] = object;
    //xx } else if (object.nodeClass === NodeClass.Variable) {
    //xx   console.log("add variable",object.browseName , object.nodeId.toString());
    //xx   this._objectMap[object.browseName] = object;
    } else if (object.nodeClass === NodeClass.ReferenceType) {
        this._referenceTypeMap[object.browseName] = object;
    } else if (object.nodeClass === NodeClass.DataType) {
        this._dataTypeMap[object.browseName] = object;
    }

};

/**
 *
 * @param nodeid
 * @returns {NodeId}
 */
AddressSpace.prototype.resolveNodeId = function (nodeid) {

    if (typeof nodeid === "string") {
        // check if the string is a known alias
        if (this._aliases.hasOwnProperty(nodeid)) {
          return this._aliases[nodeid];
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


/**
 * This Service is used to request that the Server translates one or more browse paths to NodeIds.
 * a browse path is constructed of a starting Node and a RelativePath. The specified starting Node
 * identifies the Node from which the RelativePath is based. The RelativePath contains a sequence of
 * ReferenceTypes and BrowseNames.
 * StatusCode:
 *   Bad_NodeIdUnknown
 *   Bad_NodeIdInvalid
 *   Bad_NothingToDo                - the relative path contains an empty list )
 *   Bad_BrowseNameInvalid          - target name is missing in relative path
 *   Uncertain_ReferenceOutOfServer - The path element has targets which are in another server.
 *   Bad_TooManyMatches
 *   Bad_QueryTooComplex
 *   Bad_NoMatch
 *
 *
 * @param {BrowsePath} browsePath
 * @returns {exports.BrowsePathResult}
 */
AddressSpace.prototype.browsePath = function(browsePath) {
    var self = this;

    var translate_service = require("../translate_browse_paths_to_node_ids_service");
    assert(browsePath instanceof translate_service.BrowsePath);

    var startingNode = self.findObject(browsePath.startingNode);
    if (!startingNode) {
        return  new translate_service.BrowsePathResult({statusCode: StatusCodes.Bad_NodeIdUnknown});
    }

    if(browsePath.relativePath.elements.length === 0 ) {
        return  new translate_service.BrowsePathResult({statusCode: StatusCodes.Bad_NothingToDo});
    }

    // The last element in the relativePath shall always have a targetName specified.
    var l = browsePath.relativePath.elements.length;
    var last_el = browsePath.relativePath.elements[l-1];

    if (!last_el.targetName || !last_el.targetName.name || last_el.targetName.name.length === 0) {
        return  new translate_service.BrowsePathResult({statusCode: StatusCodes.Bad_BrowseNameInvalid});
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
        return  new translate_service.BrowsePathResult({ statusCode: StatusCodes.Bad_NoMatch});
    }

    var browsePathResult = new translate_service.BrowsePathResult({
        statusCode : StatusCodes.Good,
        targets: res
    });
    return browsePathResult;
};

var rootFolderId = makeNodeId(84); // RootFolder
/**
 * convert a path string to a BrowsePath
 * @param startingNode {NodeId|string}
 * @param path {string} path such as Objects.Server
 * @returns {BrowsePath}
 *
 * @example
 *   constructBrowsePath("/","Objects");
 *   constructBrowsePath("/","Objects.Server");
 *   constructBrowsePath("/","Objects.4:Boilers");
 *
 *  '#' : HasSubType
 *  '.' : Organizes , HasProperty, HasComponent, HasNotifier
 *  '&' : HasTypeDefinition
 *
 */
function constructBrowsePath(startingNode ,path) {

    if (startingNode === "/" ) {
        startingNode = rootFolderId;
    }
    var translate_service = require("../translate_browse_paths_to_node_ids_service");

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
 *
 * @param startingNode
 * @param pathname
 * @returns {null}
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
AddressSpace.prototype.findDataType = function(browseName){
    return this._dataTypeMap[browseName];
};
AddressSpace.prototype.findVariableType = function(browseName){
    return this._variableTypeMap[browseName];
};

AddressSpace.prototype.findReferenceType = function(browseName) {
    // startingNode ns=0;i=31 : References
    //  References i=31
    //  +->(hasSubType) NoHierarchicalReferences
    //                  +->(hasSubType) HasTypeDefinition
    //  +->(hasSubType) HierarchicalReferences
    //                  +->(hasSubType) HasChild/ChildOf
    //                                  +->(hasSubType) Aggregates/AggregatedBy
    //                                                  +-> HasProperty/PropertyOf
    //                                                  +-> HasComponent/ComponentOf
    //                                                  +-> HasHistoricalConfiguration/HistoricalConfigurationOf
    //                                 +->(hasSubType) HasSubType/HasSuperType
    //                  +->(hasSubType) Organizes/OrganizedBy
    //                  +->(hasSubType) HasEventSource/EventSourceOf
    return this._referenceTypeMap[browseName];
};


exports.AddressSpace = AddressSpace;
