"use strict";

/**
 * @module opcua.address_space
 */


const NodeClass = require("node-opcua-data-model").NodeClass;
const NodeId = require("node-opcua-nodeid").NodeId;
const makeNodeId = require("node-opcua-nodeid").makeNodeId;
const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
const sameNodeId =require("node-opcua-nodeid").sameNodeId;

const assert = require("node-opcua-assert").assert;
const _ = require("underscore");
const Dequeue = require("dequeue");

const utils = require("node-opcua-utils");
const dumpIf = require("node-opcua-debug").dumpIf;

const BrowseResult = require("node-opcua-service-browse").BrowseResult;


const BrowseDirection = require("node-opcua-data-model").BrowseDirection;

const QualifiedName = require("node-opcua-data-model").QualifiedName;
const doDebug = false;

const DataTypeIds = require("node-opcua-constants").DataTypeIds;
const VariableTypeIds = require("node-opcua-constants").VariableTypeIds;



const BaseNode = require("./base_node").BaseNode;
const ReferenceType = require("./referenceType").ReferenceType;
const UAVariable = require("./ua_variable").UAVariable;
const UAVariableType = require("./ua_variable_type").UAVariableType;
const UAObjectType = require("./ua_object_type").UAObjectType;
const UAObject = require("./ua_object").UAObject;
const UAMethod = require("./ua_method").UAMethod;
const UADataType = require("./ua_data_type").UADataType;
const Reference = require("./reference").Reference;
const View = require("./view").View;



function _extract_namespace_and_browse_name_as_string(addressSpace,browseName,namespaceIndex)
{
    assert(!namespaceIndex || namespaceIndex >=0);

    let result ;

    if (namespaceIndex >0) {

        assert(typeof browseName ==="string" && "expecting a string when namespaceIndex is specified");
        result = [ addressSpace.getNamespace(namespaceIndex) , browseName];

    } else if (typeof browseName ==="string") {

        // split
        if(browseName.indexOf(":")>=0) {
            const a = browseName.split(":");
            namespaceIndex = a.length === 2 ? parseInt(a[0]) : namespaceIndex;
            browseName   = a.length === 2 ? a[1] : browseName;
        }
        result =  [addressSpace.getNamespace(namespaceIndex||0),browseName];

    } else if (browseName instanceof QualifiedName) {

        namespaceIndex = browseName.namespaceIndex;
        result =  [addressSpace.getNamespace(namespaceIndex),browseName.name];

    } else if (typeof browseName === "number") {
        result = [addressSpace.getDefaultNamespace(), DataType[browseName] ];
    }
    if (!result || !result[0]) {
        throw new Error(` Cannot find namespace associated with ${browseName} ${namespaceIndex}`);
    }
    return result;
}


/**
 * `AddressSpace` is a collection of UA nodes.
 *
 *     const addressSpace = new AddressSpace();
 *
 *
 * @class AddressSpace
 * @constructor
 */
function AddressSpace() {

    const self = this;
    self._private_namespaceIndex = 1;
    self._constructNamespaceArray();
    AddressSpace.registry.register(self);
}

const ObjectRegistry = require("node-opcua-object-registry").ObjectRegistry;
AddressSpace.registry  = new ObjectRegistry();


AddressSpace.prototype._constructNamespaceArray = function () {
    this._namespaceArray = [];
    if (this._namespaceArray.length === 0) {
        this.registerNamespace("http://opcfoundation.org/UA/");
    }
};

AddressSpace.prototype.getNamespaceUri = function (namespaceIndex) {
    assert(namespaceIndex >= 0 && namespaceIndex < this._namespaceArray.length);
    return this._namespaceArray[namespaceIndex].namespaceUri;
};

/***
 * @method getNamespace
 * @param {string|number} namespace index or namespace uri.
 * @return {NameSpace} the namespace
 */
AddressSpace.prototype.getNamespace = function (namespaceIndexOrName) {
   const self = this;
   if (typeof namespaceIndexOrName ==="number") {
        const namespaceIndex =namespaceIndexOrName;
        assert(namespaceIndex >= 0 && namespaceIndex < this._namespaceArray.length,"invalid namespace index ( out of bound)");
        return self._namespaceArray[namespaceIndex];
    } else {
       const namespaceUri =namespaceIndexOrName;
       assert(typeof namespaceUri === "string");
        const index = self.getNamespaceIndex(namespaceUri);
        return self._namespaceArray[index];
    }
};

/***
 * @method getDefaultNamespace
 * @return  {NameSpace} the  default namespace (standard OPCUA namespace)
 */
AddressSpace.prototype.getDefaultNamespace= function() {
    return this.getNamespace(0);
};


/***
 * @method getOwnNamespace
 *
 * objects instances managed by the server will be created in this namespace.
 *
 * @return  {NameSpace} address space own namespace
 */
AddressSpace.prototype.getOwnNamespace= function() {

    const self = this;
    if (this._private_namespaceIndex>=self._namespaceArray.length){
        throw new Error("please create the private namespace");
    }

    return this.getNamespace(this._private_namespaceIndex);
};


const Namespace = require("./namespace").Namespace;

/**
 * @method registerNamespace
 *
 * register a new namespace
 *
 * @param namespaceUri {string}
 * @returns {Namespace}
 */
AddressSpace.prototype.registerNamespace = function (namespaceUri) {

    const self = this;

    let index = this._namespaceArray.findIndex(ns=> ns.namespaceUri === namespaceUri);
    if (index !== -1) {
        assert(self._namespaceArray[index].addressSpace === self);
        return self._namespaceArray[index];
    }

    index= self._namespaceArray.length;
    self._namespaceArray.push(new Namespace({
        namespaceUri: namespaceUri,
        addressSpace: self,
        index: index,
        version: "undefined",
        publicationDate: new Date()
    }));
    return self._namespaceArray[index];
};

/**
 * @method getNamespaceIndex
 * @param {strings} namespaceUri
 * @return {number} the namespace index of a namespace given by its namespace uri
 *
 */
AddressSpace.prototype.getNamespaceIndex = function (namespaceUri) {
    assert(typeof namespaceUri === "string");
    const self = this;
    return  self._namespaceArray.findIndex(ns=> ns.namespaceUri === namespaceUri);
};

/***
 * @method getNamespaceArray
 * @return {Namespace[]} the namespace array
 */
AddressSpace.prototype.getNamespaceArray = function () {
    return this._namespaceArray;
};

/**
 *
 * @method addAlias
 * @param alias_name {String} the alias name
 * @param nodeId {NodeId}
 */
AddressSpace.prototype.addAlias = function (alias_name, nodeId) {
    assert(typeof alias_name === "string");
    assert(nodeId instanceof NodeId);
    this.getNamespace(nodeId.namespace).addAlias(alias_name,nodeId);
};

/**
 * find an node by node Id
 * @method findNode
 * @param nodeId {NodeId|String}  a nodeId or a string coerce-able to nodeID, representing the object to find.
 * @return {BaseNode|null}
 */
AddressSpace.prototype.findNode = function (nodeId) {
    nodeId = this.resolveNodeId(nodeId);
    assert(nodeId instanceof NodeId);
    if (nodeId.namespace  <0 || nodeId.namespace>= this._namespaceArray.length) {
        // namespace index is out of bound
        return null;
    }
    const namespace = this.getNamespace(nodeId.namespace);
    return namespace.findNode(nodeId);
};


AddressSpace.prototype.findMethod = function (nodeId) {
    const node = this.findNode(nodeId);
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






AddressSpace.prototype._register = function (node) {
    assert(node.nodeId instanceof NodeId);
    const namespace = this.getNamespace(node.nodeId.namespace);
    namespace._register(node);
};


function _getNamespace(addressSpace,nodeOrNodId){
    let nodeId = nodeOrNodId;
    if (nodeOrNodId instanceof BaseNode) {
        nodeId = nodeOrNodId.nodeId;
    }
    return addressSpace.getNamespace(nodeId.namespace);
}

AddressSpace.prototype.deleteNode = function (nodeOrNodeId) {
    _getNamespace(this,nodeOrNodeId).deleteNode(nodeOrNodeId);
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

        // split alias
        const a = nodeId.split(":");
        const namespaceIndex = a.length === 2 ? parseInt(a[0]) : 0;

        const namespace = this.getNamespace(namespaceIndex);
        // check if the string is a known alias
        const alias = namespace._aliases[nodeId];
        if (alias !== undefined) {
            return alias;
        }
    }
    return resolveNodeId(nodeId);
};


function _find_by_node_id(addressSpace,CLASS,nodeId,namespaceIndex) {
    assert (nodeId instanceof NodeId);
    assert(namespaceIndex === undefined);
    const obj = addressSpace.findNode(nodeId);
    assert(!obj || obj instanceof CLASS);
    return obj;
}


/**
 * Find the DataType node from a NodeId or a browseName
 * @method findDataType
 * @param dataType {String|NodeId}
 * @param [namespaceIndex=0 {Number}] an optional namespace index
 * @return {DataType|null}
 *
 *
 * @example
 *
 *      const dataDouble = addressSpace.findDataType("Double");
 *
 *      const dataDouble = addressSpace.findDataType(resolveNodeId("ns=0;i=3"));
 */
AddressSpace.prototype.findDataType = function (dataType,namespaceIndex) {
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
    if (dataType instanceof NodeId) {
        return _find_by_node_id(this,UADataType,dataType,namespaceIndex);
    }
    const res = _extract_namespace_and_browse_name_as_string(this,dataType,namespaceIndex);
    const namespace = res[0];
    const browseName = res[1];
    assert(namespace instanceof Namespace);
    return namespace.findDataType(browseName);
};

const DataType = require("node-opcua-variant").DataType;

/**
 * @method findCorrespondingBasicDataType
 * @param dataTypeNode
 * @returns DataType
 *
 * @example
 *
 *     const dataType = addressSpace.findDataType("ns=0;i=12");
 *     addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.String);
 *
 *     const dataType = addressSpace.findDataType("ServerStatusDataType"); // ServerStatus
 *     addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.ExtensionObject);
 *
 */
AddressSpace.prototype.findCorrespondingBasicDataType = function(dataTypeNode) /* DataType */ {

    const self =this;
    assert(dataTypeNode,"expecting a dataTypeNode");

    if (typeof dataTypeNode === "string") {
        dataTypeNode = this.resolveNodeId(dataTypeNode);
    }

    if (dataTypeNode instanceof NodeId) {
        const _orig_dataTypeNode = dataTypeNode;
        dataTypeNode = this.findDataType(dataTypeNode);
        if (!dataTypeNode) {
            throw Error("cannot find dataTypeNode " + _orig_dataTypeNode.toString());
        }
    }
    assert(dataTypeNode instanceof UADataType);

    const id =  dataTypeNode.nodeId.value;
    assert(_.isFinite(id));

    const enumerationType = self.findDataType("Enumeration");
    if (sameNodeId(enumerationType.nodeId ,dataTypeNode.nodeId)) {
        return DataType.Int32;
    }

    if (dataTypeNode.nodeId.namespace === 0 && DataType[id]) {
        return id;
    }
    return this.findCorrespondingBasicDataType(dataTypeNode.subtypeOfObj);
};

/**
 *
 * @method findObjectType
 * @param objectType  {String|NodeId|QualifiedName}
 * @param [namespaceIndex=0 {Number}] an optional namespace index
 * @return {UAObjectType|null}
 *
 * @example
 *
 *     const objectType = addressSpace.findObjectType("ns=0;i=58");
 *     objectType.browseName.toString().should.eql("BaseObjectType");
 *
 *     const objectType = addressSpace.findObjectType("BaseObjectType");
 *     objectType.browseName.toString().should.eql("BaseObjectType");
 *
 *     const objectType = addressSpace.findObjectType(resolveNodeId("ns=0;i=58"));
 *     objectType.browseName.toString().should.eql("BaseObjectType");
 *
 *     const objectType = addressSpace.findObjectType("CustomObjectType",36);
 *     objectType.nodeId.namespace.should.eql(36);
 *     objectType.browseName.toString().should.eql("BaseObjectType");
 *
 *     const objectType = addressSpace.findObjectType("36:CustomObjectType");
 *     objectType.nodeId.namespace.should.eql(36);
 *     objectType.browseName.toString().should.eql("BaseObjectType");
 */
AddressSpace.prototype.findObjectType = function (objectType,namespaceIndex) {
    if (objectType instanceof NodeId) {
        return _find_by_node_id(this,UAObjectType,objectType,namespaceIndex);
    }
    const [namespace, browseName ] = _extract_namespace_and_browse_name_as_string(this,objectType,namespaceIndex);
    return namespace.findObjectType(browseName);
};

/**
 * @method findVariableType
 * @param variableType  {String|NodeId}
 * @param [namespaceIndex=0 {Number}] an optional namespace index
 * @return {UAObjectType|null}
 *
 * @example
 *
 *     const objectType = addressSpace.findVariableType("ns=0;i=62");
 *     objectType.browseName.toString().should.eql("BaseVariableType");
 *
 *     const objectType = addressSpace.findVariableType("BaseVariableType");
 *     objectType.browseName.toString().should.eql("BaseVariableType");
 *
 *     const objectType = addressSpace.findVariableType(resolveNodeId("ns=0;i=62"));
 *     objectType.browseName.toString().should.eql("BaseVariableType");
 */
AddressSpace.prototype.findVariableType = function (variableType,namespaceIndex) {
    if (variableType instanceof NodeId) {
        return _find_by_node_id(this,UAVariableType,variableType,namespaceIndex);
    }
    const [namespace, browseName ] = _extract_namespace_and_browse_name_as_string(this,variableType,namespaceIndex);
    return namespace.findVariableType(browseName);
};



/**
 * returns true if str matches a nodeID, e.g i=123 or ns=...
 * @method isNodeIdString
 * @param str
 * @type {boolean}
 */
function isNodeIdString(str) {
    if (typeof str !== "string") {
        return false;
    }
    return str.substring(0, 2) === "i=" || str.substring(0, 3) === "ns=";
}
AddressSpace.isNodeIdString = isNodeIdString;


AddressSpace.prototype._findReferenceType = function (refType,namespaceIndex) {
    if (refType instanceof NodeId) {
        return _find_by_node_id(this,ReferenceType,refType,namespaceIndex);
    }
    const [namespace, browseName ] = _extract_namespace_and_browse_name_as_string(this,refType,namespaceIndex);
    return namespace.findReferenceType(browseName);
};

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
    //  +->(hasSubtype) NonHierarchicalReferences
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
    let node;

    if (isNodeIdString(refType)) {
        refType = resolveNodeId(refType);
    }
    if (refType instanceof NodeId) {
        node = this.findNode(refType);
        // istanbul ignore next
        if (!(node && (node.nodeClass === NodeClass.ReferenceType))) {
            // throw new Error("cannot resolve referenceId "+ refType.toString());
            return null;
        }
    } else {
        assert(_.isString(refType));
        node = this._findReferenceType(refType,namespace);
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
    return this.getDefaultNamespace().findReferenceTypeFromInverseName(inverseName);
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
    // ----------------------------------------------- handle is forward
    assert(params.isForward === undefined || typeof params.isForward === "boolean");
    params.isForward = utils.isNullOrUndefined(params.isForward) ? true : !!params.isForward;

    // referenceType = Organizes   , isForward = true =>   referenceType = Organizes , isForward = true
    // referenceType = Organizes   , isForward = false =>  referenceType = Organizes , isForward = false
    // referenceType = OrganizedBy , isForward = true =>   referenceType = Organizes , isForward = **false**
    // referenceType = OrganizedBy , isForward = false =>  referenceType = Organizes , isForward =  **true**

    // ----------------------------------------------- handle referenceType
    if (params.referenceType instanceof ReferenceType) {
        params._referenceType = params.referenceType;
        params.referenceType =  params.referenceType.nodeId;

    } else if (typeof params.referenceType === "string"){
        const inv = this.findReferenceTypeFromInverseName(params.referenceType );
        if(inv) {
            params.referenceType = inv.nodeId;
            params._referenceType = inv;
            params.isForward = !params.isForward;
        } else {
            params.referenceType = resolveNodeId(params.referenceType);
            const refType = this.findReferenceType(params.referenceType);
            if (refType) {
                params._referenceType = refType;
            }
        }
    }
    assert(params.referenceType instanceof NodeId);


    // ----------- now resolve target NodeId;
    if (params.nodeId instanceof BaseNode) {
        assert(!params.hasOwnProperty("node"));
        params.node = params.nodeId;
        params.nodeId = params.node.nodeId;
    } else {
        let _nodeId = params.nodeId;
        assert(_nodeId, "missing 'nodeId' in reference");
        if (_nodeId &&  _nodeId.nodeId) {
            _nodeId = _nodeId.nodeId;
        }
        _nodeId = resolveNodeId(_nodeId);
        // istanbul ignore next
        if (!(_nodeId instanceof NodeId) || _nodeId.isEmpty()) {
            throw new Error(" Invalid reference nodeId " + _nodeId.toString() + " " + JSON.stringify(reference,null));
        }
        params.nodeId = _nodeId;
    }

    return new Reference(params);


/*

    const n1 = this.findReferenceType(params.referenceType);
    const n2 = (typeof params.referenceType === "string") ? this.findReferenceTypeFromInverseName(params.referenceType):null;

    if (!n1 && !n2) {
        // unknown type, there is nothing we can do about it yet.
        // this case could happen when reading a nodeset.xml file for instance
        // when a reference type is being used before being defined.
        return new Reference(params);
    } else if (n1) {
        assert(!n2 || n1.nodeId.toString() === n2.nodeId.toString());
        params.referenceType = n1.nodeId;
        params._referenceType = n1;
        return new Reference(params);
    } else {
        assert(n2);
        // make sure we preserve integrity of object passed as a argument
        const new_params = _.clone(params);
        new_params.referenceType = n2.nodeId;
        new_params.isForward = !params.isForward;
        new_params._referenceType = n2;
        return new Reference(new_params);
    }
*/
};

AddressSpace.prototype.normalizeReferenceTypes = function(arr) {
    if (!arr) {
        return arr;
    }
    assert(_.isArray(arr));
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

    const n1 = this.findReferenceType(referenceType);
    const n2 = this.findReferenceTypeFromInverseName(referenceType);
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

    if (this._namespaceArray.length <= 1) {
        throw new Error("Please create a private namespace");
    }
    const privateNamespace = this.getOwnNamespace();
    return privateNamespace._build_new_NodeId();
};


AddressSpace.prototype._coerce_Type = function (dataType, typeMap, typeMapName, finderMethod) {

    assert(dataType,"expecting a dataType");
    if ( dataType instanceof BaseNode) {
        dataType = dataType.nodeId;
    }
    assert(_.isObject(typeMap));
    const self = this;
    let nodeId;
    if (typeof dataType === "string") {

        const namespace0 = self.getDefaultNamespace();
        // resolve dataType
        nodeId = namespace0._aliases[dataType];
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

    const el = finderMethod.call(this,nodeId);

    if (!el) {
        // verify that node Id exists in standard type map typeMap
        const find = _.filter(typeMap, function (a) {
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
    const self = this;
    if (dataType instanceof NodeId) {
        //xx assert(self.findDataType(dataType));
        return dataType;
    }
    return self._coerce_Type(dataType, DataTypeIds, "DataTypeIds",AddressSpace.prototype.findDataType);
};

AddressSpace.prototype._coerce_VariableTypeIds = function (dataType) {
    return this._coerce_Type(dataType, VariableTypeIds, "VariableTypeIds",AddressSpace.prototype.findVariableType);
};

AddressSpace.prototype._coerceTypeDefinition = function (typeDefinition) {
    const self = this;
    if (typeof typeDefinition === "string") {
        // coerce parent folder to an node
        typeDefinition = self.findNode(typeDefinition);
        typeDefinition = typeDefinition.nodeId;
    }
    //xx console.log("typeDefinition = ",typeDefinition);
    assert(typeDefinition instanceof NodeId);
    return typeDefinition;
};


AddressSpace.prototype._coerceType = function (baseType,topMostBaseType,nodeClass) {

    const self = this;
    assert(typeof topMostBaseType === "string");
    const topMostBaseTypeNode = self.findNode(topMostBaseType);

    // istanbul ignore next
    if (!topMostBaseTypeNode) {
        throw new Error("Cannot find topMostBaseTypeNode " + topMostBaseType.toString());
    }
    assert(topMostBaseTypeNode instanceof BaseNode);
    assert(topMostBaseTypeNode.nodeClass === nodeClass);

    if (!baseType) {
        return topMostBaseTypeNode;
    }

    assert(typeof baseType === "string" || baseType instanceof BaseNode);
    let baseTypeNode;
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
    return baseTypeNode;
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
    const self = addressSpace;
    const folderType = self.findObjectType("FolderType");
    assert(folder instanceof BaseNode);
    assert(folder.typeDefinitionObj);
    return folder.typeDefinitionObj.isSupertypeOf(folderType);
}


/**
 * @method _coerceNode
 * @param node
 * @return {*}
 * @private
 */
AddressSpace.prototype._coerceNode = function (node) {

    const self = this;

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

    const self = this;
    folder = self._coerceNode(folder);
    // istanbul ignore next
    if (folder && !_isFolder(self,folder)) {
        throw new Error("Parent folder must be of FolderType " + folder.typeDefinition.toString());
    }
    return folder;
};



AddressSpace.isNonEmptyQualifiedName = Namespace.isNonEmptyQualifiedName;


AddressSpace.prototype._collectModelChange = function(view,modelChange) {
    //xx console.log("in _collectModelChange", modelChange.verb, verbFlags.get(modelChange.verb).toString());
    this._modelChanges.push(modelChange);
};


/**
 *
 * walk up the hierarchy of objects until a view is found
 * objects may belong to multiples views.
 * Note: this method doesn't return the main view => Server object.
 * @method extractRootViews
 * @param node {BaseNode}
 * @return {BaseNode[]}
 */
AddressSpace.prototype.extractRootViews = function(node) {

    const addressSpace = this;
    assert(node.nodeClass === NodeClass.Object || node.nodeClass === NodeClass.Variable);

    const visitedMap ={};

    const q = new Dequeue();
    q.push(node);


    const objectsFolder = addressSpace.rootFolder.objects;
    assert(objectsFolder instanceof UAObject);

    const results = [];

    while(q.length) {
        node = q.shift();

        const references = node.findReferencesEx("HierarchicalReferences",BrowseDirection.Inverse);
        const parentNodes = references.map(function(r){
            return Reference._resolveReferenceNode(addressSpace,r);
        });

        parentNodes.forEach(function(parent){
            if (sameNodeId(parent.nodeId,objectsFolder.nodeId)) {
                return ; // nothing to do
            }
            if (parent.nodeClass === NodeClass.View) {
                results.push(parent);
            } else {
                const key = parent.nodeId.toString();
                if (visitedMap.hasOwnProperty(key)) {
                    return;
                }
                visitedMap[key] = parent;
                q.push(parent);
            }
        });
    }
    return results;
};

AddressSpace.prototype.modelChangeTransaction = function(func) {

    const addressSpace = this;

    this._modelChangeTransactionCounter = this._modelChangeTransactionCounter || 0;

    function beginModelChange(node) {
        /* jshint validthis:true */
        assert(this);
        this._modelChanges = addressSpace._modelChanges || [];
        assert(this._modelChangeTransactionCounter >=0);
        this._modelChangeTransactionCounter +=1;
    }
    function endModelChange(node) {
        /* jshint validthis:true */
        assert(this);
        this._modelChangeTransactionCounter -=1;

        if (this._modelChangeTransactionCounter === 0) {

            if (this._modelChanges.length === 0 ) {
                return; // nothing to do
            }
            //xx console.log( "xx dealing with ",this._modelChanges.length);
            // increase version number of participating nodes

            let nodes = _.uniq(this._modelChanges.map(function(c) { return c.affected; }));

            nodes = nodes.map(function(nodeId) { return addressSpace.findNode(nodeId); });

            nodes.forEach(_increase_version_number);
            // raise events

            if (addressSpace.rootFolder.objects.server) {

                const eventTypeNode = addressSpace.findEventType("GeneralModelChangeEventType");

                if (eventTypeNode) {
                    //xx console.log("xx raising event on server object");
                    addressSpace.rootFolder.objects.server.raiseEvent(eventTypeNode,{
                        // Part 5 - 6.4.32 GeneralModelChangeEventType
                        changes: { dataType: "ExtensionObject", value: this._modelChanges }
                    });
                }

            }
            this._modelChanges = [];

            // _notifyModelChange(this);
        }
    }

    beginModelChange.call(this);
    try {
        func();
    }
    catch(err) {
        throw err;
    }
    finally {
        endModelChange.call(this);
    }
};


function _increase_version_number(node) {
    if (node && node.nodeVersion) {
        const previousValue = parseInt(node.nodeVersion.readValue().value.value);
        node.nodeVersion.setValueFromSource({ dataType: "String", value: (previousValue+1).toString() });
        //xx console.log("xxx increasing version number of node ", node.browseName.toString(),previousValue);
    }
}


AddressSpace.prototype._resolveRequestedNamespace =  function(options)
{
    if (!options.nodeId) {
        return this.getOwnNamespace();
    }
    if (typeof options.nodeId === "string"){
        if (options.nodeId.match(/^(i|s|g|b)=/)) {
            options.nodeId = this.getOwnNamespace()._construct_nodeId(options);
        }
    }
    options.nodeId = resolveNodeId(options.nodeId);
    return this.getNamespace(options.nodeId.namespace);
};


AddressSpace.prototype.addObject =function(options) {
    return this._resolveRequestedNamespace(options).addObject(options);
};

utils.setDeprecated(AddressSpace,"addObject","use addressSpace.getOwnNamespace().addObject(..) instead");
AddressSpace.prototype.addVariable =function(options) {
    return this._resolveRequestedNamespace(options).addVariable(options);
};
utils.setDeprecated(AddressSpace,"addVariable","use addressSpace.getOwnNamespace().addVariable(..) instead");

AddressSpace.prototype.addObjectType =function(options) {
    return this._resolveRequestedNamespace(options).addObjectType(options);
};
utils.setDeprecated(AddressSpace,"addObjectType","use addressSpace.getOwnNamespace().addObjectType() instead");

AddressSpace.prototype.addVariableType =function(options) {
   return this._resolveRequestedNamespace(options).addVariableType(options);
};
utils.setDeprecated(AddressSpace,"addVariableType","use addressSpace.getOwnNamespace().addVariableType() instead");

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
    return this.getOwnNamespace().addFolder(parentFolder, options);
};
utils.setDeprecated(AddressSpace,"addFolder","use addressSpace.getOwnNamespace().addFolder(..) instead");


/**
 * cleanup all resources maintained by this addressSpace.
 * @method dispose
 */
AddressSpace.prototype.dispose = function() {

    this._namespaceArray.map(namespace=>namespace.dispose());
    this._aliases = null;

    AddressSpace.registry.unregister(this);

    if(this._shutdownTask && this._shutdownTask.length > 0) {
        throw new Error("AddressSpace#dispose : shutdown has not been called");
    }
};



/**
 * register a function that will be called when the server will perform its shut down.
 * @method registerShutdownTask
 */
AddressSpace.prototype.registerShutdownTask = function (task) {
    this._shutdownTask = this._shutdownTask || [];
    assert(_.isFunction(task));
    this._shutdownTask.push(task);
};
AddressSpace.prototype.shutdown = function() {

    //xxx console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx DO ADDRESSSPACE SHUTDOWN".bgWhite);
    const self = this;
    if (!self._shutdownTask) {
        return;
    }
    // perform registerShutdownTask
    self._shutdownTask.forEach(function (task) {
        task.call(self);
    });
    self._shutdownTask = [];
};


function adjustBrowseDescription(browseDescription, defaultValue)
{
    if (browseDescription === null || browseDescription === undefined)
        return defaultValue;
    return browseDescription;
}
exports.adjustBrowseDescription = adjustBrowseDescription;

const StatusCodes = require("node-opcua-status-code").StatusCodes;
/**
 *
 * @method browseSingleNode
 * @param nodeId {NodeId|String} : the nodeid of the element to browse
 * @param browseDescription
 * @param browseDescription.browseDirection {BrowseDirection} :
 * @param browseDescription.referenceTypeId {String|NodeId}
 * @param [session] {ServerSession}
 * @return {BrowseResult}
 */
AddressSpace.prototype.browseSingleNode = function (nodeId, browseDescription, session) {
    const addressSpace = this;
    // create default browseDescription
    browseDescription = browseDescription || {};
    browseDescription.browseDirection = adjustBrowseDescription(browseDescription.browseDirection,BrowseDirection.Forward);


    //xx console.log(util.inspect(browseDescription,{colors:true,depth:5}));
    browseDescription = browseDescription || {};

    if (typeof nodeId === "string") {
        const node = addressSpace.findNode(addressSpace.resolveNodeId(nodeId));
        if (node) {
            nodeId = node.nodeId;
        }
    }

    const browseResult = {
        statusCode: StatusCodes.Good,
        continuationPoint: null,
        references: null
    };
    if (browseDescription.browseDirection === BrowseDirection.Invalid) {
        browseResult.statusCode = StatusCodes.BadBrowseDirectionInvalid;
        return new BrowseResult(browseResult);
    }

    // check if referenceTypeId is correct
    if (browseDescription.referenceTypeId instanceof NodeId) {
        if (browseDescription.referenceTypeId.value === 0) {
            browseDescription.referenceTypeId = null;
        } else {
            const rf = addressSpace.findNode(browseDescription.referenceTypeId);
            if (!rf || !(rf instanceof ReferenceType)) {
                browseResult.statusCode = StatusCodes.BadReferenceTypeIdInvalid;
                return new BrowseResult(browseResult);
            }
        }
    }

    const obj = addressSpace.findNode(nodeId);
    if (!obj) {
        // Object Not Found
        browseResult.statusCode = StatusCodes.BadNodeIdUnknown;
        //xx console.log("xxxxxx browsing ",nodeId.toString() , " not found" );
    } else {
        browseResult.statusCode = StatusCodes.Good;
        browseResult.references = obj.browseNode(browseDescription, session);
    }
    return new BrowseResult(browseResult);
};


exports.AddressSpace = AddressSpace;


require("./address_space_add_event_type").install(AddressSpace);
require("./address_space_add_method").install(AddressSpace);
require("./address_space_browse").install(AddressSpace);

require("./address_space_construct_extension_object").install(AddressSpace);
require("./ua_two_state_variable").install(AddressSpace);

// State Machines
require("./state_machine/address_space_state_machine").install(AddressSpace);

// DI
require("./address_space_add_enumeration_type").install(AddressSpace);

require("./data_access/address_space_add_AnalogItem").install(AddressSpace);
require("./data_access/address_space_add_MultiStateDiscrete").install(AddressSpace);
require("./data_access/address_space_add_TwoStateDiscrete").install(AddressSpace);
require("./data_access/address_space_add_MultiStateValueDiscrete").install(AddressSpace);
require("./data_access/address_space_add_YArrayItem").install(AddressSpace);


require("./historical_access/address_space_historical_data_node").install(AddressSpace);

//
// Alarms & Conditions
//
require("./alarms_and_conditions/install").install(AddressSpace);

