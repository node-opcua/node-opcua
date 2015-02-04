/**
 * @module opcua.address_space
 */
require("requirish")._(module);

var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var makeNodeId  = require("lib/datamodel/nodeid").makeNodeId;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;
var s = require("lib/datamodel/structures");


var DataValue = require("lib/datamodel/datavalue").DataValue;
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;

var browse_service = require("lib/services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

var translate_service = require("lib/services/translate_browse_paths_to_node_ids_service");
var BrowsePathResult =translate_service.BrowsePathResult;


var assert  = require("better-assert");
var util = require("util");
var _ = require("underscore");

var dumpIf = require("lib/misc/utils").dumpIf;


var BaseNode = require("lib/address_space/basenode").BaseNode;
var ReferenceType= require("lib/address_space/referenceType").ReferenceType;
var Variable = require("lib/address_space/variable").Variable;
var VariableType = require("lib/address_space/variableType").VariableType;
var ObjectType = require("lib/address_space/objectType").ObjectType;
var BaseObject = require("lib/address_space/baseObject").BaseObject;
var Method = require("lib/address_space/method").Method;
var UADataType = require("lib/address_space/data_type").UADataType;

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
//xx    this._methodMap = {};

    this._private_namespace = 1;
    this._internal_id_counter = 1000;
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

AddressSpace.prototype.findMethod = function(nodeId) {
    var obj= this.findObject(nodeId);
    assert(obj instanceof Method);
    return obj;
};

/**
 *
 * @method findObjectByBrowseName
 * @param browseNameToFind {String}
 * @return {BaseNode}
 */
AddressSpace.prototype.findObjectByBrowseName = function(browseNameToFind) {

    var bucket =  this._objectMap[browseNameToFind];
    if (!bucket) return null;

    assert(_.isArray(bucket));
    if (bucket.length > 1) {
        // use parent[broweName]
        // or address_space.findObject(nodeId) instead
        throw new Error("findObjectByBrowseName found more than one item with name " +browseNameToFind);
    }
    return bucket[0];

};

function _registerObject(self,object) {

    if (!self._objectMap.hasOwnProperty(object.browseName)) {
        self._objectMap[object.browseName] = [];
    }
    self._objectMap[object.browseName].push(object);
}

function _registerObjectType(self,object) {

    assert(!self._objectTypeMap[object.browseName]," ObjectType already declared");
    self._objectTypeMap[object.browseName] = object;

}
function _registerVariableType(self,object) {

    assert(!self._variableTypeMap[object.browseName]," VariableType already declared");
    self._variableTypeMap[object.browseName] = object;

}

function _registerReferenceType(self,object) {

    assert(typeof object.browseName === "string");
    assert(object.inverseName.text);
    assert(!self._referenceTypeMap[object.browseName], " Object already declared");
    assert(!self._referenceTypeMapInv[object.inverseName], " Object already declared");
    self._referenceTypeMap[object.browseName] = object;
    self._referenceTypeMapInv[object.inverseName.text] = object;
}

function _registerDataType(self,object) {
    assert(!self._dataTypeMap[object.browseName], " DataType already declared");
    self._dataTypeMap[object.browseName] = object;
}


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
        _registerObjectType(this,object);

    } else if (object.nodeClass === NodeClass.VariableType) {
        _registerVariableType(this,object);

    } else if (object.nodeClass === NodeClass.Object) {
        _registerObject(this,object);

    } else if (object.nodeClass === NodeClass.Variable) {
        _registerObject(this,object);

    } else if (object.nodeClass === NodeClass.Method) {
        _registerObject(this,object);

    } else if (object.nodeClass === NodeClass.ReferenceType) {
        _registerReferenceType(this, object);

    } else if (object.nodeClass === NodeClass.DataType) {
        _registerDataType(this,object);


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
AddressSpace.prototype. _createObject = function(options) {


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

    // xx console.log("xxx full_name" ,obj.full_name() , obj.nodeId.toString());
    //xx assert(this.findObjectByBrowseName(obj.full_name()) === obj);

    // object shall now be registered
    assert(_.isObject(this.findObject(obj.nodeId)) && " Where is object ?");
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
    var translate_service = require("lib/services/translate_browse_paths_to_node_ids_service");

    var arr = path.split(".");
    var elements = arr.map(function(browsePathElement){

        // handle browsePathElement with namespace indexes
        var splitarray = browsePathElement.split(":");
        var namespaceIndex=0;
        if (splitarray.length === 2) {
            namespaceIndex = parseInt(splitarray[0]);
            browsePathElement = splitarray[1];
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
 * @return { referenceType: <value>, isForward: <flag>} a new object with the normalized name
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



//----------------------------------------------------------------------------------------------------------------------

AddressSpace.prototype._build_new_NodeId = function () {
    var nodeId = makeNodeId(this._internal_id_counter, this._private_namespace);
    this._internal_id_counter += 1;
    return nodeId;
};

var DataTypeIds = require("lib/opcua_node_ids").DataTypeIds;
var VariableTypeIds = require("lib/opcua_node_ids").VariableTypeIds;


AddressSpace.prototype._coerce_Type = function(dataType,typeMap,typeMapName) {

    assert(_.isObject(typeMap));
    var self = this;
    var nodeId;
    if (typeof dataType === "string") {
        // resolve datatype
        nodeId = self._aliases[dataType];
        if (!nodeId) {
            // dataType was not found in the aliases database

            if (typeMap[dataType]) {
                nodeId= makeNodeId(typeMap[dataType],0);
                return nodeId;
            } else {
                nodeId = resolveNodeId(dataType);
            }
        }
    } else if (typeof dataType === "number") {
        nodeId = makeNodeId(dataType,0);
    } else {
        nodeId = resolveNodeId(dataType);
    }

    assert(nodeId instanceof NodeId);
    assert(nodeId.namespace === 0);
    // verify that node Id exists in typeMap
    var find = _.filter(typeMap,function(a)  {return a === nodeId.value});
    if (find.length !== 1) {
        //xxx console.log("xxx cannot find ",dataType ," in ",typeMapName);
        //xxx console.log(_.map(typeMap,function(value,key){ return key + ":" + value;}).join(" ") );
        throw new Error(" cannot find " + dataType.toString() + " in typeMap " +typeMapName);
    }
    return nodeId;
};

AddressSpace.prototype._coerce_DataType = function(dataType) {
   return this._coerce_Type(dataType,DataTypeIds,"DataTypeIds");
};
AddressSpace.prototype._coerce_VariableTypeIds = function(dataType) {
    return this._coerce_Type(dataType,VariableTypeIds,"VariableTypeIds");
};

AddressSpace.prototype.addVariable = function (parentObject, options) {

    var self = this;

    var baseDataVariableTypeId = self.findVariableType("BaseDataVariableType").nodeId;

    assert(options.hasOwnProperty("browseName"));
    assert(options.hasOwnProperty("dataType"));
    // xx assert(self.FolderTypeId && self.BaseObjectTypeId); // is default address space generated.?
    assert(parentObject instanceof BaseNode);

    // ------------------------------------------ TypeDefinition
    var typeDefinition = options.typeDefinition || baseDataVariableTypeId;
    typeDefinition = self._coerce_VariableTypeIds(typeDefinition);
    assert(typeDefinition instanceof NodeId);

    // ------------------------------------------ DataType
    options.dataType = self._coerce_DataType(options.dataType);


    var valueRank = _.isUndefined(options.valueRank) ? -1 : options.valueRank;
    assert(_.isFinite(valueRank));
    assert(typeof(valueRank) === "number");

    var browseName = options.browseName;
    assert(typeof(browseName) === "string");

    var description = options.description || "";

    var newNodeId = options.nodeId || self._build_new_NodeId();

    options.arrayDimensions = options.arrayDimensions || null;
    assert(_.isArray(options.arrayDimensions)|| options.arrayDimensions === null);

    var variable = self._createObject({
        nodeId: newNodeId,
        nodeClass: NodeClass.Variable,
        dataType: options.dataType,
        browseName: browseName,
        description: description,
        valueRank: valueRank,
        accessLevel: options.accessLevel,
        userAccessLevel: options.userAccessLevel,
        historizing: options.historizing || false,
        minimumSamplingInterval: options.minimumSamplingInterval || 10,
        arrayDimensions: options.arrayDimensions,
        //xx value: value,
        references: [
            {referenceType: "HasTypeDefinition", isForward: true, nodeId: typeDefinition },
            {referenceType: "HasProperty",      isForward: false, nodeId: parentObject.nodeId }
        ]
    });
    assert(variable instanceof Variable);

    variable.propagate_back_references(self);

    if (options.value) {
        variable.bindVariable(options.value);
    }
    return variable;
};

exports.AddressSpace = AddressSpace;
