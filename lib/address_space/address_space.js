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

var utils = require("lib/misc/utils");
var dumpIf = utils.dumpIf;

var util = require("util");



var BaseNode = require("lib/address_space/base_node").BaseNode;
var ReferenceType = require("lib/address_space/referenceType").ReferenceType;
var UAVariable = require("lib/address_space/ua_variable").UAVariable;
var UAVariableType = require("lib/address_space/ua_variable_type").UAVariableType;
var UAObjectType = require("lib/address_space/ua_object_type").UAObjectType;
var UAObject = require("lib/address_space/ua_object").UAObject;
var UAMethod = require("lib/address_space/ua_method").UAMethod;
var UADataType = require("lib/address_space/ua_data_type").UADataType;
var Reference = require("lib/address_space/reference").Reference;

var View = require("lib/address_space/view").View;

var browse_service = require("lib/services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

var QualifiedName = require("lib/datamodel/qualified_name").QualifiedName;
var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;

var _DEPRECATED_SOON_REMOVED = require("lib/misc/utils")._DEPRECATED_SOON_REMOVED;
var _DEPRECATED_RENAMED = require("lib/misc/utils")._DEPRECATED_RENAMED;




/**
 * `AddressSpace` is a collection of UA nodes.
 *
 *     var addressSpace = new AddressSpace();
 *
 *
 * @class AddressSpace
 * @constructor
 */
function AddressSpace() {
    this._nodeid_index = {};
    this._aliases = {};
    this._objectTypeMap = {};
    this._variableTypeMap = {};
    this._referenceTypeMap = {};
    this._referenceTypeMapInv = {};
    this._dataTypeMap = {};

    this._private_namespace = 1;
    this._internal_id_counter = 1000;
    this._constructNamespaceArray();

    AddressSpace.registry.register(this);
}

AddressSpace.registry  = new (require("lib/misc/objectRegistry").ObjectRegistry)();


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
 * find an node by node Id
 * @method findNode
 * @param nodeId {NodeId|String}  a nodeId or a string coerce-able to nodeID, representing the object to find.
 * @return {BaseNode}
 */
AddressSpace.prototype.findNode = function (nodeId) {
    nodeId = this.resolveNodeId(nodeId);
    return this._nodeid_index[nodeId.toString()];
};
AddressSpace.prototype.findObject = _DEPRECATED_RENAMED("findObject", "findNode");

AddressSpace.prototype.findMethod = function (nodeId) {
    var node = this.findNode(nodeId);
    assert(node instanceof UAMethod);
    return node;
};


/**
 * @property rootFolder
 * @type     {BaseNode}
 */
Object.defineProperty(AddressSpace.prototype,"rootFolder", {
    get: function () {
        return this.findNode(this.resolveNodeId("RootFolder"));
    }
});


function _registerObjectType(self, node) {

    var key = node.browseName.toString();
    assert(!self._objectTypeMap[key], " UAObjectType already declared");
    self._objectTypeMap[key] = node;

}
function _unregisterObjectType() {}

function _registerVariableType(self, node) {

    var key = node.browseName.toString();
    assert(!self._variableTypeMap[key], " UAVariableType already declared");
    self._variableTypeMap[key] = node;

}

function _registerReferenceType(self, node) {

    assert(node.browseName instanceof QualifiedName);
    var key = node.browseName.toString();
    assert(node.inverseName.text);
    assert(!self._referenceTypeMap[key], " Node already declared");
    assert(!self._referenceTypeMapInv[node.inverseName], " Node already declared");
    self._referenceTypeMap[key] = node;
    self._referenceTypeMapInv[node.inverseName.text] = node;
}

function _registerDataType(self, node) {
    var key = node.browseName.toString();
    assert(node.browseName instanceof QualifiedName);
    assert(!self._dataTypeMap[key], " DataType already declared");
    self._dataTypeMap[key] = node;
}


AddressSpace.prototype._register = function (node) {

    assert(node.nodeId instanceof NodeId);
    assert(node.nodeId);
    assert(node.hasOwnProperty("browseName"));

    var indexName = node.nodeId.toString();
    if (this._nodeid_index.hasOwnProperty(indexName)) {
        throw new Error("nodeId " + node.nodeId.displayText() + " already registered " + node.nodeId.toString());
    }

    this._nodeid_index[indexName] = node;


    if (node.nodeClass === NodeClass.ObjectType) {
        _registerObjectType(this, node);

    } else if (node.nodeClass === NodeClass.VariableType) {
        _registerVariableType(this, node);

    } else if (node.nodeClass === NodeClass.Object) {
    } else if (node.nodeClass === NodeClass.Variable) {
    } else if (node.nodeClass === NodeClass.Method) {
    } else if (node.nodeClass === NodeClass.ReferenceType) {
        _registerReferenceType(this, node);

    } else if (node.nodeClass === NodeClass.DataType) {
        _registerDataType(this, node);

    } else if (node.nodeClass === NodeClass.View) {
        _registerDataType(this, node);

    } else {
        console.log("Invalid class Name", node.nodeClass);
        throw new Error("Invalid class name specified");
    }

};


/**
 * remove the specified Node from the address space
 * 
 * @method deleteNode
 * @param  nodeOrNodeId
 * 
 * 
 */
AddressSpace.prototype.deleteNode = function (nodeOrNodeId) {

    var self = this;
    var node =null;
    var nodeId;
    if (nodeOrNodeId instanceof NodeId) {
        nodeId = nodeOrNodeId;
        node = this.findNode(nodeId);
        // istanbul ignore next
        if (!node) {
            throw new Error(" deleteNode : cannot find node with nodeId" + nodeId.toString());
        }
    } else if (nodeOrNodeId instanceof BaseNode) {
        node = nodeOrNodeId;
        nodeId = node.nodeId;
    }


    // notify parent that node is being removed
    var hierarchicalReferences = node.findReferencesEx("HierarchicalReferences",BrowseDirection.Inverse);
    hierarchicalReferences.forEach(function(ref) {
        var parent = self.findNode(ref.nodeId);
        assert(parent);
        parent._on_child_removed(node);
    });


    function deleteNodePointedByReference(ref) {
        var addressSpace = self;

        var o = addressSpace.findNode(ref.nodeId);
        addressSpace.deleteNode(o.nodeId);
    }

    // recursively delete all nodes below in the hierarchy of nodes
    
    // TODO : a better idea would be to extract any references of type "HasChild"
    var components = node.findReferences("HasComponent", true);
    var properties = node.findReferences("HasProperty", true);
   
    // TODO: shall we delete nodes pointed by "Organizes" links here ?
    var subfolders = node.findReferences("Organizes", true);
    
    var rf = [].concat(components,properties,subfolders);
    
    rf.forEach(deleteNodePointedByReference);
    
    // delete nodes from global index
    var indexName = node.nodeId.toString();
    // istanbul ignore next
    if (!this._nodeid_index.hasOwnProperty(indexName)) {
        throw new Error("deleteNode : nodeId " + nodeId.displayText() + " is not registered " + nodeId.toString());
    }

    node.unpropagate_back_references();

    if (node.nodeClass === NodeClass.ObjectType) {
        _unregisterObjectType(this, node);
    //} else if (object.nodeClass === NodeClass.VariableType) {
    //    _unregisterVariableType(this,object);
    //
    } else if (node.nodeClass === NodeClass.Object) {
    } else if (node.nodeClass === NodeClass.Variable) {
    } else if (node.nodeClass === NodeClass.Method) {//
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
        console.log("Invalid class Name", node.nodeClass);
        throw new Error("Invalid class name specified");
    }

    assert(this._nodeid_index[indexName] === node);
    delete this._nodeid_index[indexName];
    node.dispose();
};

/**
 * resolved a string or a nodeId to a nodeID
 *
 * @method resolveNodeId
 * @param nodeId {NodeId|String}
 * @return {NodeId}
 */
AddressSpace.prototype.resolveNodeId = function (nodeId) {

    if (typeof nodeId === "string") {
        // check if the string is a known alias
        var alias = this._aliases[nodeId];
        if (alias !== undefined) {
            return alias;
        }
    }
    return resolveNodeId(nodeId);
};

var _constructors_map = {
    "Object":        UAObject,
    "ObjectType":    UAObjectType,
    "ReferenceType": ReferenceType,
    "Variable":      UAVariable,
    "VariableType":  UAVariableType,
    "DataType":      UADataType,
    "Method":        UAMethod,
    "View":          View
};

/**
 * @method _createNode
 * @private
 * @param options
 *
 * @param options.nodeId      {NodeId}
 * @param options.nodeClass  {NodeClass}
 * @param options.browseName {String|QualifiedName} the node browseName
 *    the browseName can be either a string : "Hello"
 *                                 a string with a namespace : "1:Hello"
 *                                 a QualifiedName : new QualifiedName({name:"Hello", namespaceIndex:1});
 * @return {BaseNode}
 * @private
 */
AddressSpace.prototype._createNode = function (options) {

    assert(typeof options.browseName === "string" || (options.browseName instanceof QualifiedName));

    var self = this;

    options.description = coerceLocalizedText(options.description);

    options.nodeId = self._construct_nodeId(options);

    dumpIf(!options.nodeId, options); // missing node Id
    assert(options.nodeId instanceof NodeId);
    assert(options.nodeClass);

    var Constructor = _constructors_map[options.nodeClass.key];
    if (!Constructor) {
        throw new Error(" missing constructor for NodeClass " + options.nodeClass.key);
    }

    options.addressSpace = this;
    var node = new Constructor(options);
    assert(node.nodeId);
    assert(node.nodeId instanceof NodeId);

    this._register(node);

    // object shall now be registered
    assert(_.isObject(this.findNode(node.nodeId)));
    return node;
};

AddressSpace.prototype._findInBrowseNameIndex = function(CLASS,index,browseNameOrNodeId,namespace) {

    if (browseNameOrNodeId instanceof NodeId) {
        assert(namespace === undefined);
        var nodeId = browseNameOrNodeId;
        var obj = this.findNode(nodeId);
        assert(!obj || obj instanceof CLASS);
        return obj;
    }
    assert(!namespace || namespace >=0);
    var browseName  = browseNameOrNodeId;

    browseName = browseName.toString();
    assert(_.isString(browseName));

    if (_.isFinite(namespace)) {
        browseName = namespace.toString() + ":" + browseName;
    }
    return index[browseName];
};

/**
 * Find the DataType node from a NodeId or a browseName
 * @param dataType {String|NodeId}
 * @param [namespace=0 {Number}] an optional namespace index
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
    return self._findInBrowseNameIndex(UADataType,this._dataTypeMap,dataType,namespace);
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
        var _orig_dataTypeNode = dataTypeNode;
        dataTypeNode = this.findDataType(dataTypeNode);
        if (!dataTypeNode) {
            throw Error("cannot find dataTypeNode " + _orig_dataTypeNode.toString());
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
 *
 * @method findObjectType
 * @param objectType  {String|NodeId}
 * @param [namespace=0 {Number}] an optional namespace index
 * @return {UAObjectType|null}
 *
 * @example:
 *
 *    var objectType = addressSpace.findDataType("ns=0;i=58");
 *    objectType.browseName.toString().should.eql("BaseObjectType");
 *
 *    var objectType = addressSpace.findDataType("BaseObjectType");
 *    objectType.browseName.toString().should.eql("BaseObjectType");
 *
 *    var objectType = addressSpace.findDataType(resolveNodeId("ns=0;i=58"));
 *    objectType.browseName.toString().should.eql("BaseObjectType");
 */
AddressSpace.prototype.findObjectType = function (objectType,namespace) {
    return this._findInBrowseNameIndex(UAObjectType,this._objectTypeMap,objectType,namespace);
};

/**
 * @method findVariableType
 * @param variableType  {String|NodeId}
 * @param [namespace=0 {Number}] an optional namespace index
 * @return {UAObjectType|null}
 *
 * @example:
 *
 *    var objectType = addressSpace.findDataType("ns=0;i=62");
 *    objectType.browseName.toString().should.eql("BaseVariableType");
 *
 *    var objectType = addressSpace.findDataType("BaseVariableType");
 *    objectType.browseName.toString().should.eql("BaseVariableType");
 *
 *    var objectType = addressSpace.findDataType(resolveNodeId("ns=0;i=62"));
 *    objectType.browseName.toString().should.eql("BaseVariableType");
 */
AddressSpace.prototype.findVariableType = function (variableType,namespace) {
    return this._findInBrowseNameIndex(UAVariableType,this._variableTypeMap,variableType,namespace);
};



/**
 * returns true if str matches a nodeID, e.g i=123 or ns=...
 * @method isNodeIdString
 * @param str
 * @type {boolean}
 */
function isNodeIdString(str) {
    if (!(typeof str === "string")) {
        return false;
    };
    return str.substring(0, 2) === "i=" || str.substring(0, 3) === "ns=";
}
AddressSpace.isNodeIdString = isNodeIdString;

/**
 * @method findReferenceType
 * @param refType {String|NodeId}
 * @param [namespace=0 {Number}] an optional namespace index
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
    var node;

    if (isNodeIdString(refType)) {
        refType = resolveNodeId(refType);
    }
    if (refType instanceof NodeId) {
        node = this.findNode(refType);
        // istanbul ignore next
        if (!(node && (node.nodeClass === NodeClass.ReferenceType))) {
            throw new Error("cannot resolve referenceId "+ refType.toString());
        }
    } else {
        assert(_.isString(refType));

        var a = refType.split(":");
        namespace = a.length === 2 ? parseInt(a[0]) : namespace;
        refType   = a.length === 2 ? a[1] : refType;

        node = this._findInBrowseNameIndex(ReferenceType,this._referenceTypeMap,refType,namespace);
        assert(!node || (node.nodeClass === NodeClass.ReferenceType && node.browseName.name.toString() === refType));
    }
    return node;
};

/**
 * find a ReferenceType by its inverse name.
 * @method findReferenceTypeFromInverseName
 * @param inverseName {String} the inverse name of the ReferenceType to find
 * @return {ReferenceType}
 */
AddressSpace.prototype.findReferenceTypeFromInverseName = function (inverseName) {

    var node = this._referenceTypeMapInv[inverseName];
    assert(!node || (node.nodeClass === NodeClass.ReferenceType && node.inverseName.text === inverseName));
    return node;
};

/**
 * @method normalizeReferenceType
 * @param params.referenceType  {String|nodeId}
 * @param params.isForward  {Boolean} default value: true;
 * @return {Object} a new reference object  with the normalized name { referenceType: <value>, isForward: <flag>}
 */
AddressSpace.prototype.normalizeReferenceType = function (params) {

    if (params instanceof Reference) {
        // a reference has already been normalized
        return params;
    }
    // referenceType = Organizes   , isForward = true =>   referenceType = Organizes ,   isForward = true
    // referenceType = Organizes   , isForward = false =>  referenceType = Organizes ,   isForward = false
    // referenceType = OrganizedBy , isForward = true =>   referenceType = Organizes , isForward = **false**
    // referenceType = OrganizedBy , isForward = false =>  referenceType = Organizes , isForward =  **true**

    assert((typeof params.referenceType === "string") || (params.referenceType instanceof NodeId));

    var obj = this.findReferenceType(params.referenceType);

    if (obj) {
        params.referenceType = obj.browseName.toString();
    } else {
        assert(_.isString(params.referenceType) && !isNodeIdString(params.referenceType)," referenceType must be a browseName");
    }

    params.isForward = utils.isNullOrUndefined(params.isForward) ? true : params.isForward;

    var n1 = this.findReferenceType(params.referenceType);
    var n2 = this.findReferenceTypeFromInverseName(params.referenceType);

    if (!n1 && !n2) {
        // unknown type, there is nothing we can do about it yet.
        // this case could happen when reading a nodeset.xml file for instance
        // when a reference type is being used before being defined.
        return new Reference(params);
    } else if (n1) {
        assert(!n2 || n1.nodeId.toString() === n2.nodeId.toString());
        return new Reference(params);
    } else {
        assert(n2);
        // make sure we preserve integrity of object passed as a argument
        var new_params = _.clone(params);
        new_params.referenceType = n2.browseName.toString();
        new_params.isForward = !params.isForward;
        return new Reference(new_params);
    }
};

AddressSpace.prototype.normalizeReferenceTypes = function(arr) {
    if (!arr) {
        return arr;
    }

    assert(_.isArray(arr));

    function resolveReferenceNodeId(reference) {

        if (reference.nodeId.nodeId) {
            reference.nodeId = reference.nodeId.nodeId;
        }
        reference.nodeId = resolveNodeId(reference.nodeId);
        // istanbul ignore next
        if (!(reference.nodeId instanceof NodeId) || reference.nodeId.isEmpty()) {
            throw new Error(" Invalid reference nodeId " + reference.nodeId.toString());
        }
    }
    arr.forEach(resolveReferenceNodeId);

    return arr.map(AddressSpace.prototype.normalizeReferenceType.bind(this));
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
 *    addressSpace.inverseReferenceType("OrganizedBy").should.eql("Organizes");
 *    addressSpace.inverseReferenceType("Organizes").should.eql("OrganizedBy");
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


AddressSpace.prototype._coerce_Type = function (dataType, typeMap, typeMapName, finderMethod) {

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

    var el = finderMethod.call(this,nodeId);

    if (!el) {
        // verify that node Id exists in standard type map typeMap
        var find = _.filter(typeMap, function (a) {
            return a === nodeId.value;
        });
        /* istanbul ignore next */
        if (find.length !== 1) {
            throw new Error(" cannot find " + dataType.toString() + " in typeMap " + typeMapName + " L = "+ find.length);
        }
    }
    return nodeId;
};

AddressSpace.prototype._coerce_DataType = function (dataType) {
    var self = this;
    if (dataType instanceof NodeId) {
        //xx assert(self.findDataType(dataType));
        return dataType;
    }
    return this._coerce_Type(dataType, DataTypeIds, "DataTypeIds",AddressSpace.prototype.findDataType);
};

AddressSpace.prototype._coerce_VariableTypeIds = function (dataType) {
    return this._coerce_Type(dataType, VariableTypeIds, "VariableTypeIds",AddressSpace.prototype.findVariableType);
};

AddressSpace.prototype._coerceTypeDefinition = function (typeDefinition) {
    var self = this;
    if (typeof typeDefinition === "string") {
        // coerce parent folder to an node
        typeDefinition = self.findNode(typeDefinition);
        typeDefinition = typeDefinition.nodeId;
    }
    //xx console.log("typeDefinition = ",typeDefinition);
    assert(typeDefinition instanceof NodeId);
    return typeDefinition;
};

function isValidModellingRule(ruleName) {
    // let restrict to Mandatory or Optional for the time being
    return ruleName === null || ruleName === "Mandatory" || ruleName === "Optional";
}

/**
 *
 * @param references
 * @param modellingRule
 * @private
 */
AddressSpace._process_modelling_rule = function (references, modellingRule) {
    if (modellingRule) {
        assert(isValidModellingRule(modellingRule), "expecting a valid modelling rule");
        var modellingRuleName = "ModellingRule_" + modellingRule;
        //assert(self.findNode(modellingRuleName),"Modelling rule must exist");
        references.push({referenceType: "HasModellingRule", nodeId: modellingRuleName});
    }
};




/**
 * @method _addVariable
 * @private
 */
AddressSpace.prototype._addVariable = function (options) {

    var self = this;

    var baseDataVariableTypeId = self.findVariableType("BaseDataVariableType").nodeId;

    assert(options.hasOwnProperty("browseName"));
    assert(options.hasOwnProperty("dataType"));

    options.historizing = !!options.historizing;

    // xx assert(self.FolderTypeId && self.BaseObjectTypeId); // is default address space generated.?

    // istanbul ignore next
    if (options.hasOwnProperty("hasTypeDefinition")) {
        throw new Error("hasTypeDefinition option is invalid. Do you mean typeDefinition instead ?");
    }
    // ------------------------------------------ TypeDefinition
    var typeDefinition = options.typeDefinition || baseDataVariableTypeId;
    typeDefinition = self._coerce_VariableTypeIds(typeDefinition);
    assert(typeDefinition instanceof NodeId);

    // ------------------------------------------ DataType
    options.dataType = self._coerce_DataType(options.dataType);

    options.valueRank = utils.isNullOrUndefined(options.valueRank) ? -1 : options.valueRank;
    assert(_.isFinite(options.valueRank));
    assert(typeof options.valueRank === "number");

    options.arrayDimensions = options.arrayDimensions || null;
    assert(_.isArray(options.arrayDimensions) || options.arrayDimensions === null);

    options.minimumSamplingInterval = +options.minimumSamplingInterval || 0;
    var references = options.references || [];

    references = [].concat(references,[
        {referenceType: "HasTypeDefinition", isForward: true, nodeId: typeDefinition}
    ]);

    AddressSpace._process_modelling_rule(references, options.modellingRule);

    assert(!options.nodeClass || options.nodeClass === NodeClass.Variable);
    options.nodeClass = NodeClass.Variable;

    options.references = references;

    var variable = self.createNode(options);
    assert(variable instanceof UAVariable);
    return variable;
};


/**
 *
 * DEPRECATED :
 *    use this instead:
 *    addVariable({
 *      propertyOf: parent
 *    });
 * add a variable as a property of the parent node
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
AddressSpace.prototype.addProperty = _DEPRECATED_SOON_REMOVED("AddressSpace#addProperty",function (parent, options) {

    console.log("AddressSpace#addProperty is deprecated : use addVariable({propertyOf: parent... });  instead")
    options.typeDefinition = options.typeDefinition || "PropertyType";

    assert(options.typeDefinition === "PropertyType", "Property must be of PropertyType");

    //xx var obj = this._addVariable(parent, "HasProperty", options);
    var prop = this._addVariable(options);
    prop.addReference({ referenceType: "HasProperty" , isForward: false, nodeId: parent.nodeId});
    return prop;
});

/**
 * add a variable as a component of the parent node
 *
 * @method addVariable
 * @param options
 * @param options
 * @param options.browseName {String} the variable name
 * @param options.dataType   {String} the variable datatype ( "Double", "UInt8" etc...)
 * @param [options.typeDefinition="BaseDataVariableType"]
 * @param [options.modellingRule=null] the Modelling rule : "Optional" , "Mandatory"
 * @return {Object}*
 */
AddressSpace.prototype.addVariable = function (options) {

    var self = this;
    assert(arguments.length === 1 ,
        "Invalid arguments AddressSpace#addVariable now takes only one argument. Please update you code");

    if (options.hasOwnProperty("propertyOf")) {
        assert(!options.typeDefinition || options.typeDefinition === "PropertyType");
        options.typeDefinition = options.typeDefinition || "PropertyType";

    } else {
        assert(!options.typeDefinition || options.typeDefinition !== "PropertyType");
    }

    return self._addVariable(options);
};


AddressSpace.prototype._identifyParentInReference = function(references) {
    assert(_.isArray(references));

    var candidates = references.filter(function(ref){
        return  (ref.referenceType === "HasComponent" || ref.referenceType === "HasProperty")  &&
                ref.isForward === false;
    });
    assert(candidates.length <=1);
    return candidates[0];
};

function __combineNodeId(parentNodeId,name) {
    var nodeId =null;
    if (parentNodeId.identifierType === NodeId.NodeIdType.STRING) {
        nodeId = resolveNodeId("ns=1;s=" +parentNodeId.value + "-" + name);
    }
    return nodeId;
}

AddressSpace.prototype._construct_nodeId = function(options) {

    var self = this;
    var nodeId = options.nodeId;
    if (!nodeId) {
        // find HasComponent, or has Property reverse
        var parentRef = self._identifyParentInReference(options.references);
        if (parentRef ) {
            assert(parentRef.nodeId instanceof NodeId);
            nodeId = __combineNodeId(parentRef.nodeId,options.browseName);
        }
    }
    nodeId = nodeId || self._build_new_NodeId();
    if (nodeId instanceof NodeId) {
        return nodeId;
    }
    nodeId = resolveNodeId(nodeId);
    assert(nodeId  instanceof NodeId);
    return nodeId;
};

AddressSpace.prototype._addObjectOrVariableType = function (options,topMostBaseType,nodeClass) {

    var self = this;

    assert(typeof topMostBaseType === "string");
    assert(nodeClass === NodeClass.ObjectType || nodeClass === NodeClass.VariableType);


    function _coerceObjectOrVariableType(baseType) {

        assert(typeof topMostBaseType === "string");
        var topMostBaseTypeNode = self.findNode(topMostBaseType);

        // istanbul ignore next
        if (!topMostBaseTypeNode) {
            throw new Error("Cannot find topMostBaseTypeNode " + topMostBaseType.toString());
        }
        assert(topMostBaseTypeNode instanceof BaseNode);
        assert(topMostBaseTypeNode.nodeClass === nodeClass);

        if (!baseType) {
            return topMostBaseTypeNode.nodeId;
        }

        assert(typeof baseType === "string" || baseType instanceof BaseNode);
        var baseTypeNode;
        if ( baseType instanceof BaseNode) {
            baseTypeNode = baseType;
        } else {
            baseTypeNode = self.findNode(baseType);
        }

        /* istanbul ignore next*/
        if (!baseTypeNode) {
            throw new Error("Cannot find ObjectType or VariableType for " + baseType.toString());
        }

        assert(baseTypeNode);
        assert(baseTypeNode.isSupertypeOf(topMostBaseTypeNode));
        //xx console.log("baseTypeNode = ",baseTypeNode.toString());
        return baseTypeNode.nodeId;
    }

    assert(!options.nodeClass);
    assert(options.browseName);
    assert(typeof options.browseName === "string");
    assert(!options.subTypeOf,"misspell error : it should be 'subtypeOf' instead");
    if (options.hasOwnProperty("hasTypeDefinition")) {
        throw new Error("hasTypeDefinition option is invalid. Do you mean typeDefinition instead ?");
    }
    assert(!options.typeDefinition, " do you mean subtypeOf ?");

    var subtypeOfNodeId = _coerceObjectOrVariableType(options.subtypeOf);
    assert(subtypeOfNodeId);

    var objectType = this._createNode({
        browseName: options.browseName,
        nodeClass:   nodeClass,
        isAbstract: !!options.isAbstract,
        eventNotifier: +options.eventNotifier,
        references: [ { referenceType: "HasSubtype", isForward: false,  nodeId: subtypeOfNodeId }]
    });
    objectType.propagate_back_references();
    objectType.install_extra_properties();
    return objectType;

};


/**
 * add a new Object type to the address space
 * @method addObjectType
 * @param options
 * @param options.browseName {String} the object type name
 * @param [options.subtypeOf="BaseObjectType"] {String|NodeId|BaseNode} the base class
 * @param [options.nodeId] {String|NodeId} an optional nodeId for this objectType, if not provided a new nodeId will be created
 * @param [options.isAbstract = false] {Boolean}
 * @param [options.eventNotifier = 0] {Integer}
 *
 */
AddressSpace.prototype.addObjectType = function (options) {
    var self = this;
    return self._addObjectOrVariableType(options,"BaseObjectType",NodeClass.ObjectType);
};


/**
 * add a new Variable type to the address space
 * @method addVariableType
 * @param options
 * @param options.browseName {String} the object type name
 * @param [options.subtypeOf="BaseVariableType"] {String|NodeId|BaseNode} the base class
 * @param [options.nodeId] {String|NodeId} an optional nodeId for this objectType, if not provided a new nodeId will be created
 * @param [options.isAbstract = false] {Boolean}
 * @param [options.eventNotifier = 0] {Integer}
 *
 */

AddressSpace.prototype.addVariableType = function (options) {
    var self = this;
    return self._addObjectOrVariableType(options,"BaseVariableType",NodeClass.VariableType);
};



AddressSpace.prototype.addView = function (options) {

    var self = this;
    assert(arguments.length === 1, "AddressSpace#addView expecting a single argument");
    assert(options);
    assert(options.hasOwnProperty("browseName"));
    assert(options.hasOwnProperty("componentOf"));
    var browseName = options.browseName;
    assert(typeof browseName === "string");

    var baseDataVariableTypeId = self.findVariableType("BaseDataVariableType").nodeId;

    // ------------------------------------------ TypeDefinition
    var typeDefinition = options.typeDefinition || baseDataVariableTypeId;
    options.references = options.references  || [];
    options.references.push[{referenceType: "HasTypeDefinition", isForward: true, nodeId: typeDefinition}];

    // xx assert(self.FolderTypeId && self.BaseObjectTypeId); // is default address space generated.?

    assert(!options.nodeClass);
    options.nodeClass = NodeClass.View;

    var view = self.createNode(options);
    assert(view instanceof View);
    assert(view.nodeId instanceof NodeId);
    return view;
};


/**
 * return true if nodeId is a Folder
 * @method _isFolder
 * @param addressSpace
 * @param folder
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
 * @deprecated
 * @method getFolder
 * @param folder   {Object|String|NodeId} the folder identifier either as an object, a nodeid string, or a NodeId.
 * @return {UAObject}  (ref(hasTypeDefinition)="FolderType")
 */
AddressSpace.prototype.getFolder = function (folder) {
    return this._coerceFolder(folder);
};

/**
 * @method _coerceNode
 * @param node
 * @returns {*}
 * @private
 */
AddressSpace.prototype._coerceNode = function (node) {

    var self = this;

    // coerce to BaseNode object
    if (!(node instanceof BaseNode)) {

        if (typeof node === "string") {
            // coerce parent folder to an object
            node = self.findNode(self.resolveNodeId(node)) || node;
        }
        if (!node || !node.typeDefinition) {
            node = self.findNode(node) || node;
            if (!node || !node.typeDefinition) {
                //xx console.log("xxxx cannot find folder ", folder);
                return null;
            }
        }
    }
    return node;
};

AddressSpace.prototype._coerceFolder = function (folder) {

    var self = this;
    folder = self._coerceNode(folder);
    // istanbul ignore next
    if (folder && !_isFolder(self,folder)) {
        throw new Error("Parent folder must be of FolderType " + folder.typeDefinition.toString());
    }
    return folder;
};


/**
 * @method _coerce_parent
 * convert a 'string' , NodeId or Object into a valid and existing object
 * @param addressSpace  {AddressSpace}
 * @param value
 * @param coerceFunc {Function}
 * @private
 */
function _coerce_parent(addressSpace, value, coerceFunc) {
    assert(_.isFunction(coerceFunc));
    if (value) {
        if (typeof value === "string") {
            value = coerceFunc.call(addressSpace, value);
        }
        if (value instanceof NodeId) {
            value = addressSpace.findNode(value);
        }
    }
    assert(!value || value instanceof BaseNode);
    return value;
}

function _handle_event_hierarchy_parent(addressSpace, references, options) {

    options.eventSourceOf = _coerce_parent(addressSpace, options.eventSourceOf, addressSpace._coerceNode);
    options.notifierOf    = _coerce_parent(addressSpace, options.notifierOf,    addressSpace._coerceNode);
    if (options.eventSourceOf) {
        assert(!options.notifierOf);
        references.push({referenceType: "HasNotifier", isForward: false, nodeId: options.eventSourceOf.nodeId});

    } else if (options.notifierOf) {
        assert(!options.eventSourceOf);
        references.push({referenceType: "HasEventSource", isForward: false, nodeId: options.notifierOf.nodeId});
    }
}

function _handle_hierarchy_parent(addressSpace, references, options) {

    options.componentOf = _coerce_parent(addressSpace, options.componentOf, addressSpace._coerceNode);
    options.propertyOf  = _coerce_parent(addressSpace, options.propertyOf,  addressSpace._coerceNode);
    options.organizedBy = _coerce_parent(addressSpace, options.organizedBy, addressSpace._coerceFolder);

    if (options.componentOf) {
        assert(!options.propertyOf);
        assert(!options.organizedBy);
        references.push({referenceType: "HasComponent", isForward: false, nodeId: options.componentOf.nodeId});
    }

    if (options.propertyOf) {
        assert(!options.componentOf);
        assert(!options.organizedBy);
        references.push({referenceType: "HasProperty", isForward: false, nodeId: options.propertyOf.nodeId});
    }

    if (options.organizedBy) {
        assert(!options.propertyOf);
        assert(!options.componentOf);
        references.push({referenceType: "Organizes", isForward: false, nodeId: options.organizedBy.nodeId});
    }
}

AddressSpace._handle_hierarchy_parent = _handle_hierarchy_parent ;

function _copy_reference(reference) {
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

function _copy_references(references) {
    references = references || [];
    return references.map(_copy_reference);
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
 * @method createNode
 * @param options
 * @param options.nodeClass
 *
 */
AddressSpace.prototype.createNode = function (options) {

    var self = this;

    assert(isNonEmptyQualifiedName(options.browseName));
    //xx assert(options.hasOwnProperty("browseName") && options.browseName.length > 0);


    assert(options.hasOwnProperty("nodeClass"));
    //xx var nodeClass = options.nodeClass || NodeClass.Object;

    options.references = this.normalizeReferenceTypes(options.references);

    var references = _copy_references(options.references);

    _handle_hierarchy_parent(self, references, options);

    _handle_event_hierarchy_parent(self,references,options);

    AddressSpace._process_modelling_rule(references, options.modellingRule);

    options.references = references;

    var node = self._createNode(options);
    assert(node.nodeId instanceof NodeId);

    node.propagate_back_references();

    node.install_extra_properties();

    return node;
};

AddressSpace.prototype.addObject =function(options) {

    assert(!options.nodeClass || options.nodeClass === NodeClass.Object);
    options.nodeClass = NodeClass.Object;

    var typeDefinition = options.typeDefinition || "BaseObjectType";
    options.references = options.references ||[];
    options.references.push({referenceType: "HasTypeDefinition", isForward: true, nodeId: typeDefinition});

    options.eventNotifier = +options.eventNotifier;
    //xx options.isAbstract = false,

    var obj  = this.createNode(options);
    assert(obj instanceof UAObject);

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
 * @param [options.typeDefinition="BaseObjectType"]
 * @return {Object}
 */
AddressSpace.prototype.addObjectInFolder = _DEPRECATED_SOON_REMOVED("AddressSpace#addObjectInFolder",function (parentObject, options) {

    var self = this;
    assert(isNonEmptyQualifiedName(options.browseName));

    parentObject = self._coerceFolder(parentObject);
    assert(parentObject && parentObject.nodeId); // should have a valid parent folder

    options.organizedBy = parentObject;

    var obj = self.addObject(options);
    return obj;
},
"use " + "addressSpace.addObject({ organizedBy: parentObject, ... });".cyan + " instead");


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

    assert(!options.typeDefinition, "addFolder does not expect typeDefinition to be defined ");
    var typeDefinition = self._coerceTypeDefinition("FolderType");

    parentFolder = self._coerceFolder(parentFolder);

    options.nodeClass = NodeClass.Object;

    options.references = [
        {referenceType: "HasTypeDefinition", isForward: true, nodeId: typeDefinition},
        {referenceType: "Organizes", isForward: false, nodeId: parentFolder.nodeId}
    ];
    var node = self._createNode(options);
    node.propagate_back_references();

    parentFolder.install_extra_properties();

    assert(node.parent === parentFolder.nodeId);
    return node;
};


AddressSpace.prototype.dispose = function() {

    _.forEach(this._nodeid_index,function(node,key){
        node.dispose();
    });
    this._nodeid_index = null;
    this._aliases = null;
    this._objectTypeMap = null;
    this._variableTypeMap = null;
    this._referenceTypeMap = null;
    this._referenceTypeMapIn = null;
    this._dataTypeMap = null;
    AddressSpace.registry.unregister(this);
};

exports.AddressSpace = AddressSpace;

require("./address_space_add_event_type").install(AddressSpace);
require("./address_space_add_method").install(AddressSpace);
require("./address_space_browse").install(AddressSpace);
require("./address_space_construct_extension_object").install(AddressSpace);

// DI
require("lib/data_access/address_space_add_AnalogItem").install(AddressSpace);
require("lib/data_access/address_space_add_MultiStateDiscreteType").install(AddressSpace);
require("lib/data_access/address_space_add_TwoStateDiscreteType").install(AddressSpace);
require("lib/data_access/address_space_add_MultiStateValueDiscreteType").install(AddressSpace);
require("lib/data_access/address_space_add_YArrayItem").install(AddressSpace);
