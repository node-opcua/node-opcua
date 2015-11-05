"use strict";

/**
 * @module opcua.address_space
 */
require("requirish")._(module);

var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;

var assert = require("better-assert");
var _ = require("underscore");

var dumpIf = require("lib/misc/utils").dumpIf;


var BaseNode = require("lib/address_space/base_node").BaseNode;
var ReferenceType = require("lib/address_space/referenceType").ReferenceType;
var UAVariable = require("lib/address_space/ua_variable").UAVariable;
var UAVariableType = require("lib/address_space/ua_variable_type").UAVariableType;
var UAObjectType = require("lib/address_space/ua_object_type").UAObjectType;
var UAObject = require("lib/address_space/ua_object").UAObject;
var UAMethod = require("lib/address_space/ua_method").UAMethod;
var UADataType = require("lib/address_space/ua_data_type").UADataType;

var View = require("lib/address_space/view").View;

var browse_service = require("lib/services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

//var _constructors = {};
//
//function registerConstructor(ConstructorFunc, nodeId) {
//    ConstructorFunc.prototype.typeDefinition = resolveNodeId(nodeId + "Node");
//    _constructors[ConstructorFunc.prototype.typeDefinition.toString()] = ConstructorFunc;
//}
//registerConstructor(UAVariable, "VariableType");
//

/**
 * `AddressSpace` is a collection of UA nodes.
 *
 *     var address_space = new AddressSpace();
 *
 *
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

    this._private_namespace = 1;
    this._internal_id_counter = 1000;
    this._constructNamespaceArray();
}


AddressSpace.prototype._constructNamespaceArray = function () {
    this._namespaceArray = [];
    if (this._namespaceArray.length === 0) {
        this.registerNamespace("http://opcfoundation.org/UA/");
    }
};

AddressSpace.prototype.getNamespaceUri = function (namespaceIndex) {
    assert(namespaceIndex >= 0 && namespaceIndex < this._namespaceArray.length);
    return this._namespaceArray[namespaceIndex];
};

AddressSpace.prototype.registerNamespace = function (namespaceUri) {
    var index = this._namespaceArray.indexOf(namespaceUri);
    if (index !== -1) { return index; }
    this._namespaceArray.push(namespaceUri);
    return this._namespaceArray.length - 1;
};

AddressSpace.prototype.getNamespaceIndex = function (namespaceUri) {
    var index = this._namespaceArray.indexOf(namespaceUri);
    return index;
};
AddressSpace.prototype.getNamespaceArray = function () {
    return this._namespaceArray;
};

/**
 *
 * @method add_alias
 * @param alias_name {String} the alias name
 * @param nodeId {NodeId}
 */
AddressSpace.prototype.add_alias = function (alias_name, nodeId) {
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

AddressSpace.prototype.findMethod = function (nodeId) {
    var obj = this.findObject(nodeId);
    assert(obj instanceof UAMethod);
    return obj;
};

/**
 *
 * @method findObjectByBrowseName
 * @param browseNameToFind {String}
 * @return {BaseNode}
 */
AddressSpace.prototype.findObjectByBrowseName = function (browseNameToFind) {

    var bucket = this._objectMap[browseNameToFind];
    if (!bucket) {
        return null;
    }

    var bucketKeys = Object.keys(bucket);

    if (bucketKeys.length > 1) {
        // use parent[browseName]
        // or address_space.findObject(nodeId) instead
        throw new Error("findObjectByBrowseName found more than one item with name " + browseNameToFind);
    }
    return bucket[bucketKeys[0]];

};

function _registerObject(self, object) {
    assert(object.browseName instanceof QualifiedName);
    var key = object.browseName.toString();
    var bucket = self._objectMap[key];
    if (!bucket) {
        bucket = {};
        self._objectMap[key] = bucket;
    }
    bucket[object.nodeId.toString()] = object;
}

function _unregisterObject(self, object) {
    var key = object.browseName.toString();
    var bucket = self._objectMap[key];
    if (bucket) {
        delete bucket[object.nodeId.toString()];
    }
}

function _registerObjectType(self, object) {

    var key = object.browseName.toString();
    assert(!self._objectTypeMap[key], " UAObjectType already declared");
    self._objectTypeMap[key] = object;

}
function _unregisterObjectType() {}

function _registerVariableType(self, object) {

    var key = object.browseName.toString();
    assert(!self._variableTypeMap[key], " UAVariableType already declared");
    self._variableTypeMap[key] = object;

}
var QualifiedName = require("lib/datamodel/qualified_name").QualifiedName;
function _registerReferenceType(self, object) {

    assert(object.browseName instanceof QualifiedName);
    var key = object.browseName.toString();
    assert(object.inverseName.text);
    assert(!self._referenceTypeMap[key], " Object already declared");
    assert(!self._referenceTypeMapInv[object.inverseName], " Object already declared");
    self._referenceTypeMap[key] = object;
    self._referenceTypeMapInv[object.inverseName.text] = object;
}

function _registerDataType(self, object) {
    var key = object.browseName.toString();
    assert(object.browseName instanceof QualifiedName);
    assert(!self._dataTypeMap[key], " DataType already declared");
    self._dataTypeMap[key] = object;
}


AddressSpace.prototype._register = function (object) {

    assert(object.nodeId instanceof NodeId);
    assert(object.nodeId);
    assert(object.hasOwnProperty("browseName"));

    var indexName = object.nodeId.toString();
    if (this._nodeid_index.hasOwnProperty(indexName)) {
        throw new Error("nodeId " + object.nodeId.displayText() + " already registered " + object.nodeId.toString());
    }

    this._nodeid_index[indexName] = object;


    if (object.nodeClass === NodeClass.ObjectType) {
        _registerObjectType(this, object);

    } else if (object.nodeClass === NodeClass.VariableType) {
        _registerVariableType(this, object);

    } else if (object.nodeClass === NodeClass.Object) {
        _registerObject(this, object);

    } else if (object.nodeClass === NodeClass.Variable) {
        _registerObject(this, object);

    } else if (object.nodeClass === NodeClass.Method) {
        _registerObject(this, object);

    } else if (object.nodeClass === NodeClass.ReferenceType) {
        _registerReferenceType(this, object);

    } else if (object.nodeClass === NodeClass.DataType) {
        _registerDataType(this, object);

    } else if (object.nodeClass === NodeClass.View) {
        _registerDataType(this, object);

    } else {
        console.log("Invalid class Name", object.nodeClass);
        throw new Error("Invalid class name specified");
    }

};


AddressSpace.prototype.deleteObject = function (objectOrNodeId) {

    var self = this;
    var object =null;

    if (objectOrNodeId instanceof NodeId) {
        var nodeId = objectOrNodeId;
        object = this.findObject(nodeId);
        // istanbul ignore next
        if (!object) {
            throw new Error(" deleteObject : cannot find object with nodeId" + nodeId.toString());
        }
    } else if (objectOrNodeId instanceof BaseNode) {
        object = objectOrNodeId;
    }


    // notify parent that node is being removed
    var hierarchicalReferences = object.findReferencesEx("HierarchicalReferences",BrowseDirection.Inverse);
    hierarchicalReferences.forEach(function(ref) {
        var parent = self.findObject(ref.nodeId);
        assert(parent);
        parent._on_child_removed(object);
    });


    function deleteObjectPointedByReference(ref) {
        var address_space = self;

        var o = address_space.findObject(ref.nodeId);
        address_space.deleteObject(o.nodeId);
    }

    // recursively delete all objects below in the hierarchy of objects
    var components = object.findReferences("HasComponent", true);
    var subfolders = object.findReferences("Organizes", true);
    var properties = object.findReferences("HasProperty", true);

    var rf = [].concat(components, subfolders, properties);
    rf.forEach(deleteObjectPointedByReference);


    // delete object from global index
    var indexName = nodeId.toString();
    // istanbul ignore next
    if (!this._nodeid_index.hasOwnProperty(indexName)) {
        throw new Error("deleteObject : nodeId " + nodeId.displayText() + " is not registered " + nodeId.toString());
    }

    delete this._nodeid_index[indexName];

    object.unpropagate_back_references(self);


    if (object.nodeClass === NodeClass.ObjectType) {
        _unregisterObjectType(this, object);

        //} else if (object.nodeClass === NodeClass.VariableType) {
        //    _unregisterVariableType(this,object);
        //
    } else if (object.nodeClass === NodeClass.Object) {
        _unregisterObject(this, object);

    } else if (object.nodeClass === NodeClass.Variable) {
        _unregisterObject(this, object);
    } else if (object.nodeClass === NodeClass.Method) {
        _unregisterObject(this, object);
        //
        //} else if (object.nodeClass === NodeClass.ReferenceType) {
        //    _registerReferenceType(this, object);
        //
        //} else if (object.nodeClass === NodeClass.DataType) {
        //    _registerDataType(this,object);
        //
        //} else if (object.nodeClass === NodeClass.View) {
        //    _registerDataType(this,object);
        //
    } else {
        console.log("Invalid class Name", object.nodeClass);
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
    "Object": UAObject,
    "ObjectType": UAObjectType,
    "ReferenceType": ReferenceType,
    "Variable": UAVariable,
    "VariableType": UAVariableType,
    "DataType": UADataType,
    "Method": UAMethod,
    "View": View
};

/**
 * @method _createObject
 * @private
 * @param options
 *
 * @param options.nodeId   {NodeId}
 * @param options.nodeClass {NodeClass}
 * @param options.browseName {String|QualifiedName} the node browseName
 *    the browseName can be either a string : "Hello"
 *                                 a string with a namespace : "1:Hello"
 *                                 a QualifiedName : new QualifiedName({name:"Hello", namespaceIndex:1});
 * @return {Object}
 * @private
 */
AddressSpace.prototype._createObject = function (options) {


    dumpIf(!options.nodeId, options); // missing node Id
    assert(options.nodeId);
    assert(options.nodeClass);
    assert(typeof options.browseName === "string" || (options.browseName instanceof QualifiedName));

    var Constructor = _constructors_map[options.nodeClass.key];
    if (!Constructor) {
        throw new Error(" missing constructor for NodeClass " + options.nodeClass.key);
    }

    options.address_space = this;
    var obj = new Constructor(options);
    assert(obj.nodeId);
    assert(obj.nodeId instanceof NodeId);
    this._register(obj);

    // object shall now be registered
    assert(_.isObject(this.findObject(obj.nodeId)) && " Where is the object ?");
    return obj;
};

AddressSpace.prototype._findInBrowseNameIndex = function(index,browseName,namespace) {

    browseName = browseName.toString();
    assert(_.isString(browseName));

    if (_.isFinite(namespace)) {
        browseName = namespace.toString() + ":" + browseName;
    }
    return index[browseName];
};

/**
 * Find the DataType object from a NodeId or a browseName
 * @param dataType {String|NodeId}
 * @returns {DataType|null}
 *
 *
 * @example:
 *
 *
 *      var dataDouble = addressSpace.findDataType("Double");
 *
 *      var dataDouble = addressSpace.findDataType(resolveNodeId("ns=0;i=3"));
 */
AddressSpace.prototype.findDataType = function (dataType,namespace) {

    var self = this;

    if (dataType instanceof NodeId) {
        dataType = this.findObject(dataType);
        assert(!dataType || dataType instanceof UADataType);
        return dataType;
    }
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
    return self._findInBrowseNameIndex(this._dataTypeMap,dataType,namespace);
};

var DataType = require("lib/datamodel/variant").DataType;

/**
 * @method findCorrespondingBasicDataType
 * @param dataTypeNode
 *
 *
 * @example:
 *
 *    var dataType = addressSpace.findDataType("ns=0;i=12");
 *    addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.String);
 *
 *    var dataType = addressSpace.findDataType("ServerStatus"); // ServerStatus
 *    addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.ExtensionObject);
 *
 */
AddressSpace.prototype.findCorrespondingBasicDataType = function(dataTypeNode) {

    var self =this;
    assert(dataTypeNode,"expecting a dataTypeNode");

    if (typeof dataTypeNode === "string") {
        dataTypeNode = this.resolveNodeId(dataTypeNode);
    }

    if (dataTypeNode instanceof NodeId) {
        dataTypeNode = this.findDataType(dataTypeNode);
        if (!dataTypeNode) {
            throw Error("cannot dataTypeNode " + dataTypeNode.toString());
        }
    }
    assert(dataTypeNode instanceof UADataType);

    var name = dataTypeNode.browseName.toString();
    var id =  dataTypeNode.nodeId.value;

    var enumerationType = self.findDataType("Enumeration");
    if (enumerationType.nodeId === dataTypeNode.nodeId) {
        return DataType.Int32;
    }

    if (dataTypeNode.nodeId.namespace === 0 && DataType.get(id)) {

        return DataType.get(id);
    }
    return this.findCorrespondingBasicDataType(dataTypeNode.subtypeOfObj);
};
/**
 * @method findObjectType
 * @param browseName
 * @param [namespace=0]
 * @returns {*}
 */
AddressSpace.prototype.findObjectType = function (browseName,namespace) {
   return this._findInBrowseNameIndex(this._objectTypeMap,browseName,namespace);
};

/**
 * @method findVariableType
 * @param browseName
 * @param [namespace=0]
 * @returns {*}
 */
AddressSpace.prototype.findVariableType = function (browseName,namespace) {
    return this._findInBrowseNameIndex(this._variableTypeMap,browseName,namespace);
};

/**
 * returns true if str matches a nodeID, e.g i=123 or ns=...
 * @method isNodeIdString
 * @param str
 * @type {boolean}
 */
function isNodeIdString(str) {
    return str.substring(0, 2) === "i=" || str.substring(0, 3) === "ns=";
}
/**
 * @method findReferenceType
 * @param refType {String}
 * @param  [namespace {UInt}=0]
 * @return {ReferenceType|null}
 *
 * refType could be
 *    a string representing a nodeid       : e.g.    'i=9004' or ns=1;i=6030
 *    a string representing a browse name  : e.g     'HasTypeDefinition'
 *      in this case it should be in the alias list
 *
 */
AddressSpace.prototype.findReferenceType = function (refType,namespace) {
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
    var object;
    if (isNodeIdString(refType)) {
        refType = resolveNodeId(refType);
    }
    if (refType instanceof NodeId) {
        object = this.findObject(refType);

        // istanbul ignore next
        if (!(object && (object.nodeClass === NodeClass.ReferenceType))) {
            throw new Error("cannot resolve referenceId "+ refType.toString());
        }
    } else {
        assert(_.isString(refType));

        var a = refType.split(":");
        namespace = a.length === 2 ? parseInt(a[0]) : namespace;
        refType   = a.length === 2 ? a[1] : refType;

        object = this._findInBrowseNameIndex(this._referenceTypeMap,refType,namespace);
        assert(!object || (object.nodeClass === NodeClass.ReferenceType && object.browseName.name.toString() === refType));
    }
    return object;
};

/**
 * find a ReferenceType by its inverse name.
 * @method findReferenceTypeFromInverseName
 * @param inverseName {String} the inverse name of the ReferenceType to find
 * @return {ReferenceType}
 */
AddressSpace.prototype.findReferenceTypeFromInverseName = function (inverseName) {

    var object = this._referenceTypeMapInv[inverseName];
    assert(!object || (object.nodeClass === NodeClass.ReferenceType && object.inverseName.text === inverseName));
    return object;
};

function isNullOrUndefined(v) {
    return v === null || v === undefined;
}
/**
 * @method normalizeReferenceType
 * @param params.referenceType  {String}
 * @param params.isForward  {Boolean} default value: true;
 * @return {Object} a new object with the normalized name { referenceType: <value>, isForward: <flag>}
 */
AddressSpace.prototype.normalizeReferenceType = function (params) {
    // referenceType = Organizes   , isForward = true =>   referenceType = Organizes ,   isForward = true
    // referenceType = Organizes   , isForward = false =>  referenceType = Organizes ,   isForward = false
    // referenceType = OrganizedBy , isForward = true =>   referenceType = Organizes , isForward = **false**
    // referenceType = OrganizedBy , isForward = false =>  referenceType = Organizes , isForward =  **true**


    assert(typeof params.referenceType === "string");
    params.isForward = isNullOrUndefined(params.isForward) ? true : params.isForward;

    var n1 = this.findReferenceType(params.referenceType);
    var n2 = this.findReferenceTypeFromInverseName(params.referenceType);

    if (!n1 && !n2) {
        // unknown type, there is nothing we can do about it
        return params;
    } else if (n1) {
        assert(!n2);
        return params;
    } else {
        assert(n2);
        // make sure we preserve integrity of object passed as a argument
        var new_params = _.clone(params);
        new_params.referenceType = n2.browseName.toString();
        new_params.isForward = !params.isForward;
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
AddressSpace.prototype.inverseReferenceType = function (referenceType) {

    assert(typeof referenceType === "string");

    var n1 = this.findReferenceType(referenceType);
    var n2 = this.findReferenceTypeFromInverseName(referenceType);
    if (n1) {
        assert(!n2);
        return n1.inverseName.text;
    } else {
        assert(n2);
        return n2.browseName.toString();
    }
};


//----------------------------------------------------------------------------------------------------------------------

AddressSpace.prototype._build_new_NodeId = function () {
    var nodeId;
    do {
        nodeId = makeNodeId(this._internal_id_counter, this._private_namespace);
    this._internal_id_counter += 1;
    } while(this._nodeid_index.hasOwnProperty(nodeId));

    return nodeId;
};

var DataTypeIds = require("lib/opcua_node_ids").DataTypeIds;
var VariableTypeIds = require("lib/opcua_node_ids").VariableTypeIds;


AddressSpace.prototype._coerce_Type = function (dataType, typeMap, typeMapName) {

    assert(_.isObject(typeMap));
    var self = this;
    var nodeId;
    if (typeof dataType === "string") {
        // resolve dataType
        nodeId = self._aliases[dataType];
        if (!nodeId) {
            // dataType was not found in the aliases database

            if (typeMap[dataType]) {
                nodeId = makeNodeId(typeMap[dataType], 0);
                return nodeId;
            } else {
                nodeId = resolveNodeId(dataType);
            }
        }
    } else if (typeof dataType === "number") {
        nodeId = makeNodeId(dataType, 0);
    } else {
        nodeId = resolveNodeId(dataType);
    }
    assert(nodeId instanceof NodeId);

    // verify that node Id exists in standard type map typeMap
    var find = _.filter(typeMap, function (a) {
        return a === nodeId.value;
    });

    /* istanbul ignore next */
    if (find.length !== 1) {

        //xxx console.log("xxx cannot find ",dataType ," in ",typeMapName);
        //xxx console.log(_.map(typeMap,function(value,key){ return key + ":" + value;}).join(" ") );
        throw new Error(" cannot find " + dataType.toString() + " in typeMap " + typeMapName + " L = "+ find.length);
    }
    return nodeId;
};

AddressSpace.prototype._coerce_DataType = function (dataType) {

    var self = this;
    if (dataType instanceof NodeId) {
        //xx assert(self.findDataType(dataType));
        return dataType;
    }
    return this._coerce_Type(dataType, DataTypeIds, "DataTypeIds");
};

AddressSpace.prototype._coerce_VariableTypeIds = function (dataType) {
    return this._coerce_Type(dataType, VariableTypeIds, "VariableTypeIds");
};

AddressSpace.prototype._coerceTypeDefinition = function (hasTypeDefinition) {
    var self = this;
    if (typeof hasTypeDefinition === "string") {
        // coerce parent folder to an object
        hasTypeDefinition = self.findObject(hasTypeDefinition);
        hasTypeDefinition = hasTypeDefinition.nodeId;
    }
    //xx console.log("hasTypeDefinition = ",hasTypeDefinition);
    assert(hasTypeDefinition instanceof NodeId);
    return hasTypeDefinition;
};

function isValidModellingRule(ruleName) {
    // let restrict to Mandatory or Optional for the time being
    return ruleName === null || ruleName === "Mandatory" || ruleName === "Optional";
}

/**
 * @method _addVariable
 * @private
 */
AddressSpace.prototype._addVariable = function (parentObject, hierarchyType, options) {

    var self = this;

    parentObject = self._coerceObject(parentObject);

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
    assert(typeof valueRank === "number");

    var browseName = options.browseName.toString();
    assert(typeof browseName === "string");

    var description = options.description || "";

    var newNodeId = options.nodeId || self._build_new_NodeId();

    options.arrayDimensions = options.arrayDimensions || null;
    assert(_.isArray(options.arrayDimensions) || options.arrayDimensions === null);

    assert(hierarchyType === "HasComponent" || hierarchyType === "HasProperty");

    var references = options.references || [];
    references = [].concat(references,[
        {referenceType: "HasTypeDefinition", nodeId: typeDefinition},
        {referenceType: hierarchyType, isForward: false, nodeId: parentObject.nodeId}
    ]);

    function _process_modelling_rule(references, modellingRule) {
        if (modellingRule) {
            assert(isValidModellingRule(modellingRule), "expecting a valid modelling rule");
            var modellingRuleName = "ModellingRule_" + modellingRule;
            //assert(self.findObject(modellingRuleName),"Modelling rule must exist");
            references.push({referenceType: "HasModellingRule", nodeId: modellingRuleName});
        }
    }

    _process_modelling_rule(references, options.modellingRule);

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
        minimumSamplingInterval: options.minimumSamplingInterval || 0,
        arrayDimensions: options.arrayDimensions,
        //xx value: value,
        references: references
    });
    assert(variable instanceof UAVariable);

    variable.propagate_back_references(self);

    //xx options.value = options.value || {};
    if (options.value) {
        variable.bindVariable(options.value);
    }
    variable.install_extra_properties();


    parentObject._on_child_added(variable);

    return variable;
};


/**
 * add a variable as a property of the parent object
 *
 * @method addProperty
 * @param parent
 * @param options
 * @param options
 * @param options.browseName {String} the variable name
 * @param options.dataType   {String} the variable datatype ( "Double", "UInt8" etc...)
 * @param [options.typeDefinition="BaseDataVariableType"]
 * @param [options.modellingRule=null]
 * @return {Object}*
 */
AddressSpace.prototype.addProperty = function (parent, options) {
    options.typeDefinition = options.typeDefinition || "PropertyType";
    assert(options.typeDefinition === "PropertyType");
    var obj = this._addVariable(parent, "HasProperty", options);
    return obj;
};

/**
 * add a variable as a component of the parent object
 *
 * @method addVariable
 * @param parent
 * @param options
 * @param options
 * @param options.browseName {String} the variable name
 * @param options.dataType   {String} the variable datatype ( "Double", "UInt8" etc...)
 * @param [options.typeDefinition="BaseDataVariableType"]
 * @param [options.modellingRule=null] the Modelling rule : "Optional" , "Mandatory"
 * @return {Object}*
 */
AddressSpace.prototype.addVariable = function (parent, options) {
    assert(!options.typeDefinition || options.typeDefinition !== "PropertyType");
    return this._addVariable(parent, "HasComponent", options);
};


/**
 *
 * @param address_space {AddressSpace}
 * @param objectType {String|UAObject}
 * @return {NodeId}
 * @private
 */
function _coerceObjectType(address_space,objectType) {
    if (!objectType) {
        return null;
    }
    objectType = objectType.browseName ? objectType.browseName.toString() : objectType;
    assert(objectType === "BaseObjectType" || address_space.findObjectType(objectType), "type Definition must exists");
    var subtypeOfNodeId = address_space.findObjectType(objectType).nodeId;
    return subtypeOfNodeId;
}

/**
 * add a new Object type to the address space
 * @method addObjectType
 * @param options
 * @param options.browseName {String} the object type name
 * @param [options.subtypeOf="BaseObjectType"] {String|NodeId} the base class
 * @param [options.nodeId] {String|NodeId} an optional nodeId for this objectType, if not provided a new nodeId will be created
 * @param [options.isAbstract = false] {Boolean}
 * @param [options.eventNotifier = 0] {Integer}
 *
 */
AddressSpace.prototype.addObjectType = function (options) {

    var self = this;
    assert(options.browseName);
    assert(typeof options.browseName === "string");
    assert(!options.subTypeOf,"misspell error : it should be 'subtypeOf' instead");
    assert(!options.typeDefinition && !options.hasTypeDefinition, " do you mean subtypeOf ?");

    var nodeId = options.nodeId || self._build_new_NodeId();
    assert(nodeId instanceof NodeId);

    var subtypeOfNodeId = _coerceObjectType(self,options.subtypeOf || "BaseObjectType");

    /* istanbul ignore next*/
    if (!subtypeOfNodeId) {
        throw new Error("Cannot find ObjectType for " +options.subtypeOf.toString());
    }


    var objectType = this._createObject({
        nodeId: nodeId,
        browseName: options.browseName,
        nodeClass: options.nodeClass || NodeClass.ObjectType,
        isAbstract: !!options.isAbstract,
        eventNotifier: +options.eventNotifier,
        references: [
            {
                referenceType: "HasSubtype", isForward: false,
                nodeId: subtypeOfNodeId
            }
        ]
    });
    objectType.propagate_back_references(self);
    objectType.install_extra_properties();
    return objectType;

};


AddressSpace.prototype.addView = function (parentObject, options) {

    var self = this;

    assert(parentObject instanceof BaseNode);

    var baseDataVariableTypeId = self.findVariableType("BaseDataVariableType").nodeId;
    // ------------------------------------------ TypeDefinition
    var typeDefinition = options.typeDefinition || baseDataVariableTypeId;


    assert(options);
    assert(options.hasOwnProperty("browseName"));
    // xx assert(self.FolderTypeId && self.BaseObjectTypeId); // is default address space generated.?
    assert(parentObject instanceof BaseNode);
    var browseName = options.browseName;
    assert(typeof browseName === "string");
    var description = options.description || "";
    var newNodeId = options.nodeId || self._build_new_NodeId();


    var view = self._createObject({
        nodeId: newNodeId,
        nodeClass: NodeClass.View,
        browseName: browseName,
        description: description,
        references: [
            {referenceType: "HasTypeDefinition", isForward: true, nodeId: typeDefinition},
            {referenceType: "HasProperty", isForward: false, nodeId: parentObject.nodeId}
        ]
    });
    assert(view instanceof View);

    view.propagate_back_references(self);

    return view;
};


/**
 * return true if nodeId is a Folder
 * @method _isFolder
 * @param addressSpace
 * @param nodeId
 * @return {Boolean}
 * @private
 */
function _isFolder(addressSpace,folder) {
    var self = addressSpace;
    var folderType = self.findObjectType("FolderType");
    assert(folder instanceof BaseNode);
    assert(folder.typeDefinitionObj);
    return folder.typeDefinitionObj.isSupertypeOf(folderType);
}

/**
 *
 * @method getFolder
 * @param folder   {Object|String|NodeId} the folder identifier either as an object, a nodeid string, or a NodeId.
 * @return {UAObject}  hasTypeDefinition: FolderType
 */
AddressSpace.prototype.getFolder = function (folder) {
    return this._coerceFolder(folder);
};

AddressSpace.prototype._coerceObject = function (obj) {

    var self = this;

    // coerce to BaseNode object
    if (!(obj instanceof BaseNode)) {

        if (typeof obj === "string") {
            // coerce parent folder to an object
            obj = self.findObjectByBrowseName(obj) || obj;
        }
        if (!obj || !obj.hasTypeDefinition) {
            obj = self.findObject(obj) || obj;
            if (!obj || !obj.hasTypeDefinition) {
                //xx console.log("xxxx cannot find folder ", folder);
                return null;
            }
        }
    }
    return obj;
};

AddressSpace.prototype._coerceFolder = function (folder) {

    var self = this;
    folder = self._coerceObject(folder);
    // istanbul ignore next
    if (folder && !_isFolder(self,folder)) {
        throw new Error("Parent folder must be of FolderType " + folder.hasTypeDefinition.toString());
    }
    return folder;
};


/**
 * @method _coerce_parent
 * convert a 'string' , NodeId or Object into a valid and existing object
 * @param value
 * @private
 */
function _coerce_parent(address_space, value, coerceFunc) {
    assert(_.isFunction(coerceFunc));
    if (value) {
        if (typeof value === "string") {
            value = coerceFunc.call(address_space, value);
        }
        if (value instanceof NodeId) {
            value = address_space.findObject(value);
        }
    }
    assert(!value || value instanceof BaseNode);
    return value;
}

function _handle_event_hierarchy_parent(address_space, references, options) {
    options.eventSourceOf = _coerce_parent(address_space, options.eventSourceOf, address_space._coerceFolder);
    options.notifierOf    = _coerce_parent(address_space, options.notifierOf, address_space._coerceFolder);
    if (options.eventSourceOf) {
        assert(!options.notifierOf);
        references.push({referenceType: "HasNotifier", isForward: false, nodeId: options.eventSourceOf.nodeId});

    } else if (options.notifierOf) {
        assert(!options.eventSourceOf);
        references.push({referenceType: "HasEventSource", isForward: false, nodeId: options.notifierOf.nodeId});
    }
}

function _handle_hierarchy_parent(address_space, references, options) {

    options.componentOf = _coerce_parent(address_space, options.componentOf, address_space._coerceFolder);
    options.organizedBy = _coerce_parent(address_space, options.organizedBy, address_space._coerceFolder);
    if (options.componentOf) {
        assert(!options.organizedBy);
        references.push({referenceType: "HasComponent", isForward: false, nodeId: options.componentOf.nodeId});

    } else if (options.organizedBy) {
        assert(!options.componentOf);
        references.push({referenceType: "Organizes", isForward: false, nodeId: options.organizedBy.nodeId});
    }
}
AddressSpace._handle_hierarchy_parent = _handle_hierarchy_parent ;

function _clone_reference(reference) {
    assert(reference.hasOwnProperty("referenceType"));
    assert(reference.hasOwnProperty("isForward"));
    assert(reference.hasOwnProperty("nodeId"));
    assert(reference.nodeId instanceof NodeId);
    return {
        referenceType: reference.referenceType,
        isForward: reference.isForward,
        nodeId: reference.nodeId
    };
}

function _clone_references(references) {
    references = references || [];
    return references.map(_clone_reference);
}

function isNonEmptyQualifiedName(browseName) {
    if (!browseName) {
        return false;
    }
    if (typeof browseName === "string") {
        return browseName.length >= 0;
    }
    assert(browseName instanceof QualifiedName);
    return browseName.name.length > 0;
}
AddressSpace.isNonEmptyQualifiedName = isNonEmptyQualifiedName;
/**
 * @method addObject
 * @param options
 *
 */
AddressSpace.prototype.addObject = function (options) {

    var self = this;

    assert(isNonEmptyQualifiedName(options.browseName));
    //xx assert(options.hasOwnProperty("browseName") && options.browseName.length > 0);

    var nodeClass = options.nodeClass || NodeClass.Object;

    var hasTypeDefinition = options.hasTypeDefinition || "BaseObjectType";

    var newNodeId = options.nodeId || self._build_new_NodeId();

    var references = _clone_references(options.references);

    _handle_hierarchy_parent(self, references, options);

    _handle_event_hierarchy_parent(self,references,options);

    references.push({referenceType: "HasTypeDefinition", isForward: true, nodeId: hasTypeDefinition});


    var obj = self._createObject({
        nodeClass: nodeClass,
        isAbstract: false,
        nodeId: newNodeId,
        browseName: options.browseName,
        description: options.description || "",
        eventNotifier: +options.eventNotifier,
        references: references
    });
    assert(obj.nodeId !== null);
    obj.propagate_back_references(self);
    return obj;
};
/**
 * @method addObjectInFolder
 * @param parentObject {BaseNode|String|NodeId} the parent folder (must be of type FolderType or a subtype of it)
 * @param options {Object}
 * @param [options.nodeId=null] {NodeId} the object nodeid.
 * @param [options.browseName=""] {String} the object browse name.
 * @param [options.description=""] {String} the object description.
 * @param options.eventNotifier {Number} the event notifier flag.
 * @param [options.hasTypeDefinition="BaseObjectType"]
 * @return {Object}
 */
AddressSpace.prototype.addObjectInFolder = function (parentObject, options) {

    var self = this;
    assert(isNonEmptyQualifiedName(options.browseName));

    parentObject = self._coerceFolder(parentObject);

    assert(parentObject && parentObject.nodeId); // should have a valid parent folder
    options.organizedBy = parentObject;
    var obj = self.addObject(options);
    return obj;
};


/**
 *
 * @method addFolder
 * @param parentFolder
 * @param options {String|Object}
 * @param options.browseName {String} the name of the folder
 * @param [options.nodeId] {NodeId}. An optional nodeId for this object
 *
 * @return {BaseNode}
 */
AddressSpace.prototype.addFolder = function (parentFolder, options) {

    var self = this;
    if (typeof options === "string") {
        options = {browseName: options};
    }

    assert(!options.hasTypeDefinition, "addFolder does not expect hasTypeDefinition to be defined ");
    var hasTypeDefinition = self._coerceTypeDefinition("FolderType");

    parentFolder = self._coerceFolder(parentFolder);

    options.nodeId = options.nodeId || self._build_new_NodeId();

    options.nodeClass = NodeClass.Object;

    options.references = [
        {referenceType: "HasTypeDefinition", isForward: true, nodeId: hasTypeDefinition},
        {referenceType: "Organizes", isForward: false, nodeId: parentFolder.nodeId}
    ];
    var object = self._createObject(options);
    object.propagate_back_references(self);
    assert(object.parent === parentFolder.nodeId);
    return object;
};


exports.AddressSpace = AddressSpace;

require("./address_space_add_event_type").install(AddressSpace);
require("./address_space_add_method").install(AddressSpace);
require("./address_space_browse").install(AddressSpace);
require("./address_space_construct_extension_object").install(AddressSpace);
