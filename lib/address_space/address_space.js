/**
 * @module opcua.address_space
 */

import { NodeClass } from "lib/datamodel/nodeclass";
import { NodeId } from "lib/datamodel/nodeid";
import { makeNodeId } from "lib/datamodel/nodeid";
import { resolveNodeId } from "lib/datamodel/nodeid";
import { sameNodeId } from "lib/datamodel/nodeid";
import assert from "better-assert";
import _ from "underscore";
import Dequeue from "dequeue";
import { 
  dumpIf,
  isNullOrUndefined } from "lib/misc/utils";

import util from "util";
import { BaseNode } from "lib/address_space/base_node";
import { ReferenceType } from "lib/address_space/referenceType";
import { UAVariable } from "lib/address_space/ua_variable";
import { UAVariableType } from "lib/address_space/ua_variable_type";
import { UAObjectType } from "lib/address_space/ua_object_type";
import { UAObject } from "lib/address_space/ua_object";
import { UAMethod } from "lib/address_space/ua_method";
import { UADataType } from "lib/address_space/ua_data_type";
import { Reference } from "lib/address_space/reference";
import { View } from "lib/address_space/view";
import { BrowseDirection } from "lib/services/browse_service";

import { QualifiedName } from "lib/datamodel/qualified_name";
import { coerceLocalizedText } from "lib/datamodel/localized_text";
import {
  _handle_model_change_event,
  _handle_delete_node_model_change_event
} from "./address_space_change_event_tools";
import { DataType } from "lib/datamodel/variant";

import { DataTypeIds } from "lib/opcua_node_ids";
import { VariableTypeIds } from "lib/opcua_node_ids";


import { install as address_space_add_event_type_install } from "lib/address_space/address_space_add_event_type";
import { install as address_space_add_method_install } from "lib/address_space/address_space_add_method";
import { install as address_space_browse_install } from "lib/address_space/address_space_browse";
import { install as address_space_construct_extension_object_install } from "lib/address_space/address_space_construct_extension_object";
import { install as ua_two_state_variable_install } from "lib/address_space/ua_two_state_variable";

// State Machines
import { install as address_space_state_machine_install } from "lib/address_space/state_machine/address_space_state_machine";

// HA
import { install as address_space_historical_data_node_install } from "lib/address_space/historical_access/address_space_historical_data_node";

// DI
import { install as address_space_add_AnalogItem_install } from "lib/data_access/address_space_add_AnalogItem";
import { install as address_space_add_MultiStateDiscrete_install } from "lib/data_access/address_space_add_MultiStateDiscrete";
import { install as address_space_add_TwoStateDiscrete_install } from "lib/data_access/address_space_add_TwoStateDiscrete";
import { install as address_space_add_MultiStateValueDiscrete_install } from "lib/data_access/address_space_add_MultiStateValueDiscrete";
import { install as address_space_add_YArrayItem_install } from "lib/data_access/address_space_add_YArrayItem";
import { install as address_space_add_enumeration_type_install } from "lib/address_space/address_space_add_enumeration_type";

import { install as alarms_and_conditions_install } from "lib/address_space/alarms_and_conditions/install";


/**
 * `AddressSpace` is a collection of UA nodes.
 *
 *     var addressSpace = new AddressSpace();
 *
 *
 * @class AddressSpace
 * @constructor
 */
class AddressSpace {
  constructor() {
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

  _constructNamespaceArray() {
    this._namespaceArray = [];
    if (this._namespaceArray.length === 0) {
      this.registerNamespace("http://opcfoundation.org/UA/");
    }
  }

  getNamespaceUri(namespaceIndex) {
    assert(namespaceIndex >= 0 && namespaceIndex < this._namespaceArray.length);
    return this._namespaceArray[namespaceIndex];
  }

  registerNamespace(namespaceUri) {
    const index = this._namespaceArray.indexOf(namespaceUri);
    if (index !== -1) { return index; }
    this._namespaceArray.push(namespaceUri);
    return this._namespaceArray.length - 1;
  }

  getNamespaceIndex(namespaceUri) {
    return  this._namespaceArray.indexOf(namespaceUri);
  }

  getNamespaceArray() {
    return this._namespaceArray;
  }

  /**
   *
   * @method add_alias
   * @param alias_name {String} the alias name
   * @param nodeId {NodeId}
   */
  add_alias(alias_name, nodeId) {
    assert(typeof alias_name === "string");
    assert(nodeId instanceof NodeId);
    this._aliases[alias_name] = nodeId;
  }

  /**
   * find an node by node Id
   * @method findNode
   * @param nodeId {NodeId|String}  a nodeId or a string coerce-able to nodeID, representing the object to find.
   * @return {BaseNode}
   */
  findNode(nodeId) {
    nodeId = this.resolveNodeId(nodeId);
    return this._nodeid_index[nodeId.toString()];
  }

  findMethod(nodeId) {
    const node = this.findNode(nodeId);
    assert(node instanceof UAMethod);
    return node;
  }

  /**
   * @property rootFolder
   * @type     {BaseNode}
   */
  get rootFolder() {
    return this.findNode(this.resolveNodeId("RootFolder"));
  }

  _register(node) {
    assert(node.nodeId instanceof NodeId);
    assert(node.nodeId);
    assert(node.hasOwnProperty("browseName"));

    const indexName = node.nodeId.toString();
    if (this._nodeid_index.hasOwnProperty(indexName)) {
      throw new Error(`nodeId ${node.nodeId.displayText()} already registered ${node.nodeId.toString()}`);
    }

    this._nodeid_index[indexName] = node;


    if (node.nodeClass === NodeClass.ObjectType) {
      _registerObjectType(this, node);
    } else if (node.nodeClass === NodeClass.VariableType) {
      _registerVariableType(this, node);
    } else if (node.nodeClass === NodeClass.Object) {
    } else if (node.nodeClass === NodeClass.Variable) {
    } else if (node.nodeClass === NodeClass.Method) {
    } else if (node.nodeClass === NodeClass.View) {
    } else if (node.nodeClass === NodeClass.ReferenceType) {
      _registerReferenceType(this, node);
    } else if (node.nodeClass === NodeClass.DataType) {
      _registerDataType(this, node);
    } else {
      console.log("Invalid class Name", node.nodeClass);
      throw new Error("Invalid class name specified");
    }
  }

  /**
   * remove the specified Node from the address space
   *
   * @method deleteNode
   * @param  nodeOrNodeId
   *
   *
   */
  deleteNode(nodeOrNodeId) {
    const self = this;
    let node = null;
    let nodeId;
    if (nodeOrNodeId instanceof NodeId) {
      nodeId = nodeOrNodeId;
      node = this.findNode(nodeId);
          // istanbul ignore next
      if (!node) {
        throw new Error(` deleteNode : cannot find node with nodeId${nodeId.toString()}`);
      }
    } else if (nodeOrNodeId instanceof BaseNode) {
      node = nodeOrNodeId;
      nodeId = node.nodeId;
    }

    const addressSpace = self;

    addressSpace.modelChangeTransaction(() => {
          // notify parent that node is being removed
      const hierarchicalReferences = node.findReferencesEx("HierarchicalReferences", BrowseDirection.Inverse);
      hierarchicalReferences.forEach((ref) => {
        const parent = self.findNode(ref.nodeId);
        assert(parent);
        parent._on_child_removed(node);
      });

      function deleteNodePointedByReference(ref) {
        const addressSpace = self;
        const o = addressSpace.findNode(ref.nodeId);
        addressSpace.deleteNode(o.nodeId);
      }

          // recursively delete all nodes below in the hierarchy of nodes
          // TODO : a better idea would be to extract any references of type "HasChild"
      const components = node.findReferences("HasComponent", true);
      const properties = node.findReferences("HasProperty", true);

          // TODO: shall we delete nodes pointed by "Organizes" links here ?
      const subfolders = node.findReferences("Organizes", true);
      const rf = [].concat(components, properties, subfolders);

      rf.forEach(deleteNodePointedByReference);

          // delete nodes from global index
      const indexName = node.nodeId.toString();
          // istanbul ignore next
      if (!addressSpace._nodeid_index.hasOwnProperty(indexName)) {
        throw new Error(`deleteNode : nodeId ${nodeId.displayText()} is not registered ${nodeId.toString()}`);
      }

      _handle_delete_node_model_change_event(node);

      node.unpropagate_back_references();

      if (node.nodeClass === NodeClass.ObjectType) {
        _unregisterObjectType(addressSpace, node);
      } else if (node.nodeClass === NodeClass.Object) {
      } else if (node.nodeClass === NodeClass.Variable) {
      } else if (node.nodeClass === NodeClass.Method) {
      } else if (node.nodeClass === NodeClass.View) {
      } else {
        console.log("Invalid class Name", node.nodeClass);
        throw new Error("Invalid class name specified");
      }
      assert(addressSpace._nodeid_index[indexName] === node);
      delete addressSpace._nodeid_index[indexName];
      node.dispose();
    });
  }

  /**
   * resolved a string or a nodeId to a nodeID
   *
   * @method resolveNodeId
   * @param nodeId {NodeId|String}
   * @return {NodeId}
   */
  resolveNodeId(nodeId) {
    if (typeof nodeId === "string") {
          // check if the string is a known alias
      const alias = this._aliases[nodeId];
      if (alias !== undefined) {
        return alias;
      }
    }
    return resolveNodeId(nodeId);
  }

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
  _createNode(options) {
    assert(typeof options.browseName === "string" || (options.browseName instanceof QualifiedName));

    const self = this;

    options.description = coerceLocalizedText(options.description);

    options.nodeId = self._construct_nodeId(options);

    dumpIf(!options.nodeId, options); // missing node Id
    assert(options.nodeId instanceof NodeId);
    assert(options.nodeClass);

    const Constructor = _constructors_map[options.nodeClass.key];
    if (!Constructor) {
      throw new Error(` missing constructor for NodeClass ${options.nodeClass.key}`);
    }

    options.addressSpace = this;
    const node = new Constructor(options);
    assert(node.nodeId);
    assert(node.nodeId instanceof NodeId);

    this._register(node);

      // object shall now be registered
    assert(_.isObject(this.findNode(node.nodeId)));
    return node;
  }

  _findInBrowseNameIndex(CLASS, index, browseNameOrNodeId, namespace) {
    if (browseNameOrNodeId instanceof NodeId) {
      assert(namespace === undefined);
      const nodeId = browseNameOrNodeId;
      const obj = this.findNode(nodeId);
      assert(!obj || obj instanceof CLASS);
      return obj;
    }
    assert(!namespace || namespace >= 0);
    let browseName  = browseNameOrNodeId;
    if (namespace) {
      browseName = `${namespace.toString()}:${browseName}`;
    }
    return index[browseName];
  }

  /**
   * Find the DataType node from a NodeId or a browseName
   * @method findDataType
   * @param dataType {String|NodeId}
   * @param [namespace=0 {Number}] an optional namespace index
   * @return {DataType|null}
   *
   *
   * @example
   *
   *      var dataDouble = addressSpace.findDataType("Double");
   *
   *      var dataDouble = addressSpace.findDataType(resolveNodeId("ns=0;i=3"));
   */
  findDataType(dataType, namespace) {
    const self = this;
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
  }

  /**
   * @method findCorrespondingBasicDataType
   * @param dataTypeNode
   *
   *
   * @example
   *
   *     var dataType = addressSpace.findDataType("ns=0;i=12");
   *     addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.String);
   *
   *     var dataType = addressSpace.findDataType("ServerStatus"); // ServerStatus
   *     addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.ExtensionObject);
   *
   */
  findCorrespondingBasicDataType(dataTypeNode) {
    const self = this;
    assert(dataTypeNode,"expecting a dataTypeNode");

    if (typeof dataTypeNode === "string") {
      dataTypeNode = this.resolveNodeId(dataTypeNode);
    }

    if (dataTypeNode instanceof NodeId) {
      const _orig_dataTypeNode = dataTypeNode;
      dataTypeNode = this.findDataType(dataTypeNode);
      if (!dataTypeNode) {
        throw Error(`cannot find dataTypeNode ${_orig_dataTypeNode.toString()}`);
      }
    }
    assert(dataTypeNode instanceof UADataType);

    const name = dataTypeNode.browseName.toString();
    const id =  dataTypeNode.nodeId.value;

    const enumerationType = self.findDataType("Enumeration");
    if (enumerationType.nodeId === dataTypeNode.nodeId) {
      return DataType.Int32;
    }

    if (dataTypeNode.nodeId.namespace === 0 && DataType.get(id)) {
      return DataType.get(id);
    }
    return this.findCorrespondingBasicDataType(dataTypeNode.subtypeOfObj);
  }

  /**
   *
   * @method findObjectType
   * @param objectType  {String|NodeId}
   * @param [namespace=0 {Number}] an optional namespace index
   * @return {UAObjectType|null}
   *
   * @example
   *
   *     var objectType = addressSpace.findDataType("ns=0;i=58");
   *     objectType.browseName.toString().should.eql("BaseObjectType");
   *
   *     var objectType = addressSpace.findDataType("BaseObjectType");
   *     objectType.browseName.toString().should.eql("BaseObjectType");
   *
   *     var objectType = addressSpace.findDataType(resolveNodeId("ns=0;i=58"));
   *     objectType.browseName.toString().should.eql("BaseObjectType");
   */
  findObjectType(objectType, namespace) {
    return this._findInBrowseNameIndex(UAObjectType,this._objectTypeMap,objectType,namespace);
  }

  /**
   * @method findVariableType
   * @param variableType  {String|NodeId}
   * @param [namespace=0 {Number}] an optional namespace index
   * @return {UAObjectType|null}
   *
   * @example
   *
   *     var objectType = addressSpace.findDataType("ns=0;i=62");
   *     objectType.browseName.toString().should.eql("BaseVariableType");
   *
   *     var objectType = addressSpace.findDataType("BaseVariableType");
   *     objectType.browseName.toString().should.eql("BaseVariableType");
   *
   *     var objectType = addressSpace.findDataType(resolveNodeId("ns=0;i=62"));
   *     objectType.browseName.toString().should.eql("BaseVariableType");
   */
  findVariableType(variableType, namespace) {
    return this._findInBrowseNameIndex(UAVariableType,this._variableTypeMap,variableType,namespace);
  }

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
  findReferenceType(refType, namespace) {
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
    let node;

    if (isNodeIdString(refType)) {
      refType = resolveNodeId(refType);
    }
    if (refType instanceof NodeId) {
      node = this.findNode(refType);
          // istanbul ignore next
      if (!(node && (node.nodeClass === NodeClass.ReferenceType))) {
        throw new Error(`cannot resolve referenceId ${refType.toString()}`);
      }
    } else {
      assert(_.isString(refType));
      if (refType.indexOf(":") >= 0) {
        const a = refType.split(":");
        namespace = a.length === 2 ? parseInt(a[0]) : namespace;
        refType   = a.length === 2 ? a[1] : refType;
      }
      node = this._findInBrowseNameIndex(ReferenceType,this._referenceTypeMap,refType,namespace);
      assert(!node || (node.nodeClass === NodeClass.ReferenceType && node.browseName.name.toString() === refType));
    }
    return node;
  }

  /**
   * find a ReferenceType by its inverse name.
   * @method findReferenceTypeFromInverseName
   * @param inverseName {String} the inverse name of the ReferenceType to find
   * @return {ReferenceType}
   */
  findReferenceTypeFromInverseName(inverseName) {
    const node = this._referenceTypeMapInv[inverseName];
    assert(!node || (node.nodeClass === NodeClass.ReferenceType && node.inverseName.text === inverseName));
    return node;
  }

  /**
   * @method normalizeReferenceType
   * @param params.referenceType  {String|nodeId}
   * @param params.isForward  {Boolean} default value: true;
   * @return {Object} a new reference object  with the normalized name { referenceType: <value>, isForward: <flag>}
   */
  normalizeReferenceType(params) {
    if (params instanceof Reference) {
          // a reference has already been normalized
      return params;
    }
    assert(params.isForward === undefined || typeof params.isForward === "boolean");

      // referenceType = Organizes   , isForward = true =>   referenceType = Organizes , isForward = true
      // referenceType = Organizes   , isForward = false =>  referenceType = Organizes , isForward = false
      // referenceType = OrganizedBy , isForward = true =>   referenceType = Organizes , isForward = **false**
      // referenceType = OrganizedBy , isForward = false =>  referenceType = Organizes , isForward =  **true**

    assert((typeof params.referenceType === "string") || (params.referenceType instanceof NodeId));

    const obj = this.findReferenceType(params.referenceType);

    if (obj) {
      params.referenceType = obj.browseName.toString();
    } else {
      assert(_.isString(params.referenceType) && !isNodeIdString(params.referenceType)," referenceType must be a browseName");
    }

    params.isForward = isNullOrUndefined(params.isForward) ? true : params.isForward;

    const n1 = this.findReferenceType(params.referenceType);
    const n2 = this.findReferenceTypeFromInverseName(params.referenceType);

    if (!n1 && !n2) {
          // unknown type, there is nothing we can do about it yet.
          // this case could happen when reading a nodeset.xml file for instance
          // when a reference type is being used before being defined.
      return new Reference(params);
    } else if (n1) {
      assert(!n2 || n1.nodeId.toString() === n2.nodeId.toString());
      return new Reference(params);
    } 
    assert(n2);
          // make sure we preserve integrity of object passed as a argument
    const new_params = _.clone(params);
    new_params.referenceType = n2.browseName.toString();
    new_params.isForward = !params.isForward;
    return new Reference(new_params);
  }

  normalizeReferenceTypes(arr) {
    if (!arr) {
      return arr;
    }

    assert(_.isArray(arr));

    function resolveReferenceNodeId(reference) {
      let _nodeId = reference.nodeId;
      assert(_nodeId, "missing 'nodeId' in reference");
      if (_nodeId &&  _nodeId.nodeId) {
        _nodeId = _nodeId.nodeId;
      }
      _nodeId = resolveNodeId(_nodeId);
          // istanbul ignore next
      if (!(_nodeId instanceof NodeId) || _nodeId.isEmpty()) {
        throw new Error(` Invalid reference nodeId ${_nodeId.toString()} ${JSON.stringify(reference,null)}`);
      }
      reference.nodeId = _nodeId;
    }
    arr.forEach(resolveReferenceNodeId);

    return arr.map(AddressSpace.prototype.normalizeReferenceType.bind(this));
  }

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
  inverseReferenceType(referenceType) {
    assert(typeof referenceType === "string");

    const n1 = this.findReferenceType(referenceType);
    const n2 = this.findReferenceTypeFromInverseName(referenceType);
    if (n1) {
      assert(!n2);
      return n1.inverseName.text;
    } 
    assert(n2);
    return n2.browseName.toString();
  }

  //----------------------------------------------------------------------------------------------------------------------

  _build_new_NodeId() {
    let nodeId;
    do {
      nodeId = makeNodeId(this._internal_id_counter, this._private_namespace);
      this._internal_id_counter += 1;
    } while (this._nodeid_index.hasOwnProperty(nodeId));

    return nodeId;
  }

  _coerce_Type(dataType, typeMap, typeMapName, finderMethod) {
    assert(dataType,"expecting a dataType");
    if (dataType instanceof BaseNode) {
      dataType = dataType.nodeId;
    }
    assert(_.isObject(typeMap));
    const self = this;
    let nodeId;
    if (typeof dataType === "string") {
          // resolve dataType
      nodeId = self._aliases[dataType];
      if (!nodeId) {
              // dataType was not found in the aliases database

        if (typeMap[dataType]) {
          nodeId = makeNodeId(typeMap[dataType], 0);
          return nodeId;
        } 
        nodeId = resolveNodeId(dataType);
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
      const find = _.filter(typeMap, a => a === nodeId.value);
          /* istanbul ignore next */
      if (find.length !== 1) {
        throw new Error(` cannot find ${dataType.toString()} in typeMap ${typeMapName} L = ${find.length}`);
      }
    }
    return nodeId;
  }

  _coerce_DataType(dataType) {
    const self = this;
    if (dataType instanceof NodeId) {
          // xx assert(self.findDataType(dataType));
      return dataType;
    }
    return this._coerce_Type(dataType, DataTypeIds, "DataTypeIds",AddressSpace.prototype.findDataType);
  }

  _coerce_VariableTypeIds(dataType) {
    return this._coerce_Type(dataType, VariableTypeIds, "VariableTypeIds",AddressSpace.prototype.findVariableType);
  }

  _coerceTypeDefinition(typeDefinition) {
    const self = this;
    if (typeof typeDefinition === "string") {
          // coerce parent folder to an node
      typeDefinition = self.findNode(typeDefinition);
      typeDefinition = typeDefinition.nodeId;
    }
      // xx console.log("typeDefinition = ",typeDefinition);
    assert(typeDefinition instanceof NodeId);
    return typeDefinition;
  }

  /**
   * @method _addVariable
   * @private
   */
  _addVariable(options) {
    const self = this;

    const baseDataVariableTypeId = self.findVariableType("BaseDataVariableType").nodeId;

    assert(options.hasOwnProperty("browseName"));
    assert(options.hasOwnProperty("dataType"));

    options.historizing = !!options.historizing;

      // xx assert(self.FolderTypeId && self.BaseObjectTypeId); // is default address space generated.?

      // istanbul ignore next
    if (options.hasOwnProperty("hasTypeDefinition")) {
      throw new Error("hasTypeDefinition option is invalid. Do you mean typeDefinition instead ?");
    }
      // ------------------------------------------ TypeDefinition
    let typeDefinition = options.typeDefinition || baseDataVariableTypeId;
    typeDefinition = self._coerce_VariableTypeIds(typeDefinition);
    assert(typeDefinition instanceof NodeId);

      // ------------------------------------------ DataType
    options.dataType = self._coerce_DataType(options.dataType);

    options.valueRank = isNullOrUndefined(options.valueRank) ? -1 : options.valueRank;
    assert(_.isFinite(options.valueRank));
    assert(typeof options.valueRank === "number");

    options.arrayDimensions = options.arrayDimensions || null;
    assert(_.isArray(options.arrayDimensions) || options.arrayDimensions === null);
      // -----------------------------------------------------


    options.minimumSamplingInterval = +options.minimumSamplingInterval || 0;
    let references = options.references || [];

    references = [].concat(references,[
          { referenceType: "HasTypeDefinition", isForward: true, nodeId: typeDefinition }
    ]);

    assert(!options.nodeClass || options.nodeClass === NodeClass.Variable);
    options.nodeClass = NodeClass.Variable;

    options.references = references;

    const variable = self.createNode(options);
    assert(variable instanceof UAVariable);
    return variable;
  }

  /**
   * add a variable as a component of the parent node
   *
   * @method addVariable
   * @param options
   * @param options.browseName {String} the variable name
   * @param options.dataType   {String} the variable datatype ( "Double", "UInt8" etc...)
   * @param [options.typeDefinition="BaseDataVariableType"]
   * @param [options.modellingRule=null] the Modelling rule : "Optional" , "Mandatory"
   * @param [options.valueRank= -1]   {Int} the valueRank
   * @param [options.arrayDimensions] {null| Array{Int}}
   * @return {Object}*
   */
  addVariable(options) {
    const self = this;
    assert(arguments.length === 1 ,
          "Invalid arguments AddressSpace#addVariable now takes only one argument. Please update your code");

    if (options.hasOwnProperty("propertyOf") && options.propertyOf) {
      assert(!options.typeDefinition || options.typeDefinition === "PropertyType");
      options.typeDefinition = options.typeDefinition || "PropertyType";
    } else {
      assert(!options.typeDefinition || options.typeDefinition !== "PropertyType");
    }

    return self._addVariable(options);
  }

  _identifyParentInReference(references) {
    assert(_.isArray(references));

    const candidates = references.filter(ref => (ref.referenceType === "HasComponent" || ref.referenceType === "HasProperty")  &&
              ref.isForward === false);
    assert(candidates.length <= 1);
    return candidates[0];
  }

  _construct_nodeId(options) {
    const self = this;
    let nodeId = options.nodeId;
    if (!nodeId) {
          // find HasComponent, or has Property reverse
      const parentRef = self._identifyParentInReference(options.references);
      if (parentRef) {
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
  }

  _coerceType(baseType, topMostBaseType, nodeClass) {
    const self = this;
    assert(typeof topMostBaseType === "string");
    const topMostBaseTypeNode = self.findNode(topMostBaseType);

      // istanbul ignore next
    if (!topMostBaseTypeNode) {
      throw new Error(`Cannot find topMostBaseTypeNode ${topMostBaseType.toString()}`);
    }
    assert(topMostBaseTypeNode instanceof BaseNode);
    assert(topMostBaseTypeNode.nodeClass === nodeClass);

    if (!baseType) {
      return topMostBaseTypeNode;
    }

    assert(typeof baseType === "string" || baseType instanceof BaseNode);
    let baseTypeNode;
    if (baseType instanceof BaseNode) {
      baseTypeNode = baseType;
    } else {
      baseTypeNode = self.findNode(baseType);
    }

      /* istanbul ignore next*/
    if (!baseTypeNode) {
      throw new Error(`Cannot find ObjectType or VariableType for ${baseType.toString()}`);
    }

    assert(baseTypeNode);
    assert(baseTypeNode.isSupertypeOf(topMostBaseTypeNode));
      // xx console.log("baseTypeNode = ",baseTypeNode.toString());
    return baseTypeNode;
  }

  _addObjectOrVariableType(options, topMostBaseType, nodeClass) {
    const self = this;

    assert(typeof topMostBaseType === "string");
    assert(nodeClass === NodeClass.ObjectType || nodeClass === NodeClass.VariableType);

    assert(!options.nodeClass);
    assert(options.browseName);
    assert(typeof options.browseName === "string");


    const references = [];

    function process_subtypeOf_options(self,options,references) {
          // check common misspelling mistake
      assert(!options.subTypeOf,"misspell error : it should be 'subtypeOf' instead");
      if (options.hasOwnProperty("hasTypeDefinition")) {
        throw new Error("hasTypeDefinition option is invalid. Do you mean typeDefinition instead ?");
      }
      assert(!options.typeDefinition, " do you mean subtypeOf ?");

      const subtypeOfNodeId = self._coerceType(options.subtypeOf,topMostBaseType,nodeClass);

      assert(subtypeOfNodeId);
      references.push({ referenceType: "HasSubtype", isForward: false,  nodeId: subtypeOfNodeId });
    }
    process_subtypeOf_options(self,options,references);


    const objectType = this._createNode({
      browseName:    options.browseName,
      nodeClass,
      isAbstract:    !!options.isAbstract,
      eventNotifier: +options.eventNotifier,
      references
    });

    objectType.propagate_back_references();

    objectType.install_extra_properties();

    objectType.installPostInstallFunc(options.postInstantiateFunc);

    return objectType;
  }

  /**
   * add a new Object type to the address space
   * @method addObjectType
   * @param options
   * @param options.browseName {String} the object type name
   * @param [options.subtypeOf="BaseObjectType"] {String|NodeId|BaseNode} the base class
   * @param [options.nodeId] {String|NodeId} an optional nodeId for this objectType, if not provided a new nodeId will be created
   * @param [options.isAbstract = false] {Boolean}
   * @param [options.eventNotifier = 0] {Integer}
   * @param [options.postInstantiateFunc = null] {Function}
   *
   */
  addObjectType(options) {
    const self = this;
    assert(!options.hasOwnProperty("dataType"),"an objectType should not have a dataType");
    assert(!options.hasOwnProperty("valueRank"),"an objectType should not have a valueRank");
    assert(!options.hasOwnProperty("arrayDimensions"),"an objectType should not have a arrayDimensions");
    return self._addObjectOrVariableType(options,"BaseObjectType",NodeClass.ObjectType);
  }

  /**
   * add a new Variable type to the address space
   * @method addVariableType
   * @param options
   * @param options.browseName {String} the object type name
   * @param [options.subtypeOf="BaseVariableType"] {String|NodeId|BaseNode} the base class
   * @param [options.nodeId] {String|NodeId} an optional nodeId for this objectType, if not provided a new nodeId will be created
   * @param [options.isAbstract = false] {Boolean}
   * @param [options.eventNotifier = 0] {Integer}
   * @param options.dataType {String|NodeId} the variable DataType
   * @param [options.valueRank = -1]
   * @param [options.arrayDimensions = null] { Array<Int>>
   *
   */

  addVariableType(options) {
    const self = this;
    assert(!options.hasOwnProperty("arrayDimension"),"Do you mean ArrayDimensions ?");

      // dataType
    options.dataType = options.dataType || "Int32";
    options.dataType = self._coerce_DataType(options.dataType);

      // valueRank
    options.valueRank = isNullOrUndefined(options.valueRank) ? -1 : options.valueRank;
    assert(_.isFinite(options.valueRank));
    assert(typeof options.valueRank === "number");

      // arrayDimensions
    options.arrayDimensions = options.arrayDimensions || null;
    assert(_.isArray(options.arrayDimensions) || options.arrayDimensions === null);

    const variableType =  self._addObjectOrVariableType(options,"BaseVariableType",NodeClass.VariableType);

    variableType.dataType = options.dataType;
    variableType.valueRank = options.valueRank;
    variableType.arrayDimensions = options.arrayDimensions;

    return variableType;
  }

  addView(options) {
    const self = this;
    assert(arguments.length === 1, "AddressSpace#addView expecting a single argument");
    assert(options);
    assert(options.hasOwnProperty("browseName"));
    assert(options.hasOwnProperty("organizedBy"));
    const browseName = options.browseName;
    assert(typeof browseName === "string");

    const baseDataVariableTypeId = self.findVariableType("BaseDataVariableType").nodeId;

      // ------------------------------------------ TypeDefinition
    const typeDefinition = options.typeDefinition || baseDataVariableTypeId;
    options.references = options.references  || [];
    options.references.push[{ referenceType: "HasTypeDefinition", isForward: true, nodeId: typeDefinition }];

      // xx assert(self.FolderTypeId && self.BaseObjectTypeId); // is default address space generated.?

    assert(!options.nodeClass);
    options.nodeClass = NodeClass.View;

    const view = self.createNode(options);
    assert(view instanceof View);
    assert(view.nodeId instanceof NodeId);
    assert(view.nodeClass === NodeClass.View);
    return view;
  }

  /**
   * @method _coerceNode
   * @param node
   * @return {*}
   * @private
   */
  _coerceNode(node) {
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
                  // xx console.log("xxxx cannot find folder ", folder);
          return null;
        }
      }
    }
    return node;
  }

  _coerceFolder(folder) {
    const self = this;
    folder = self._coerceNode(folder);
      // istanbul ignore next
    if (folder && !_isFolder(self,folder)) {
      throw new Error(`Parent folder must be of FolderType ${folder.typeDefinition.toString()}`);
    }
    return folder;
  }

  _collectModelChange(view, modelChange) {
      // xx console.log("in _collectModelChange", modelChange.verb, verbFlags.get(modelChange.verb).toString());
    this._modelChanges.push(modelChange);
  }

  /**
   *
   * walk up the hierarchy of objects until a view is found
   * objects may belong to multiples views.
   * Note: this method doesn't return the main view => Server object.
   * @method extractRootViews
   * @param node {BaseNode}
   * @return {BaseNode[]}
   */
  extractRootViews(node) {
    const addressSpace = this;
    assert(node.nodeClass === NodeClass.Object || node.nodeClass === NodeClass.Variable);

    const visitedMap = {};

    const q = new Dequeue();
    q.push(node);


    const objectsFolder = addressSpace.rootFolder.objects;
    assert(objectsFolder instanceof UAObject);

    const results = [];

    while (q.length) {
      node = q.shift();

      const references = node.findReferencesEx("HierarchicalReferences",BrowseDirection.Inverse);
      const parentNodes = references.map(r => Reference._resolveReferenceNode(addressSpace,r));

      parentNodes.forEach((parent) => {
        if (sameNodeId(parent.nodeId,objectsFolder.nodeId)) {
          return; // nothing to do
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
  }

  modelChangeTransaction(func) {
    const addressSpace = this;

    this._modelChangeTransactionCounter = this._modelChangeTransactionCounter || 0;

    function beginModelChange(node) {
      this._modelChanges = this._modelChanges || [];
      assert(this._modelChangeTransactionCounter >= 0);
      assert(this);
      this._modelChangeTransactionCounter += 1;
    }
    function endModelChange(node) {
      assert(this);
      this._modelChangeTransactionCounter -= 1;

      if (this._modelChangeTransactionCounter === 0) {
        if (this._modelChanges.length === 0) {
          return; // nothing to do
        }
              // xx console.log( "xx dealing with ",this._modelChanges.length);
              // increase version number of participating nodes

        let nodes = _.uniq(this._modelChanges.map(c => c.affected));

        nodes = nodes.map(nodeId => addressSpace.findNode(nodeId));

        nodes.forEach(_increase_version_number);
              // raise events

        if (addressSpace.rootFolder.objects.server) {
          const eventTypeNode = addressSpace.findEventType("GeneralModelChangeEventType");

          if (eventTypeNode) {
                      // xx console.log("xx raising event on server object");
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
    }  catch (err) {
      throw err;
    }  finally {
      endModelChange.call(this);
    }
  }

  /**
   * @method createNode
   * @param options
   * @param options.nodeClass
   * @param [options.nodeVersion {String} = "0" ] install nodeVersion
   *
   */
  createNode(options) {
    const self = this;

    let node = null;
    self.modelChangeTransaction(() => {
      assert(isNonEmptyQualifiedName(options.browseName));
          // xx assert(options.hasOwnProperty("browseName") && options.browseName.length > 0);


      assert(options.hasOwnProperty("nodeClass"));


      options.references = self.normalizeReferenceTypes(options.references);

      const references = _copy_references(options.references);

      _handle_hierarchy_parent(self, references, options);

      _handle_event_hierarchy_parent(self,references,options);

      AddressSpace._process_modelling_rule(references, options.modellingRule);

      options.references = references;

      node = self._createNode(options);
      assert(node.nodeId instanceof NodeId);

      node.propagate_back_references();

      node.install_extra_properties();

      _handle_node_version(node,options);

      _handle_model_change_event(node);
    });
    return node;
  }

  addObject(options) {
    assert(!options.nodeClass || options.nodeClass === NodeClass.Object);
    options.nodeClass = NodeClass.Object;

    const typeDefinition = options.typeDefinition || "BaseObjectType";
    options.references = options.references || [];
    options.references.push({ referenceType: "HasTypeDefinition", isForward: true, nodeId: typeDefinition });

    options.eventNotifier = +options.eventNotifier;
      // xx options.isAbstract = false,

    const obj  = this.createNode(options);
    assert(obj instanceof UAObject);
    assert(obj.nodeClass === NodeClass.Object);
    return obj;
  }

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
  addFolder(parentFolder, options) {
    const self = this;
    if (typeof options === "string") {
      options = { browseName: options };
    }

    assert(!options.typeDefinition, "addFolder does not expect typeDefinition to be defined ");
    const typeDefinition = self._coerceTypeDefinition("FolderType");

    parentFolder = self._coerceFolder(parentFolder);

    options.nodeClass = NodeClass.Object;

    options.references = [
          { referenceType: "HasTypeDefinition", isForward: true, nodeId: typeDefinition },
          { referenceType: "Organizes", isForward: false, nodeId: parentFolder.nodeId }
    ];
    const node = self.createNode(options);
    return node;
  }

  /**
   * cleanup all resources maintained by this addressSpace.
   * @method dispose
   */
  dispose() {
    _.forEach(this._nodeid_index,(node, key) => {
      node.dispose();
    });
    this._nodeid_index = null;
    this._aliases = null;
    this._objectTypeMap = null;
    this._variableTypeMap = null;
    this._referenceTypeMap = null;
    this._referenceTypeMapInv = null;
    this._dataTypeMap = null;
    AddressSpace.registry.unregister(this);
  }

  /**
   * @method addReferenceType
   * @param options
   * @param options.isAbstract
   * @param options.browseName
   * @param options.inverseName
   */
  addReferenceType(options) {
    const addressSpace = this;
    options.nodeClass  = NodeClass.ReferenceType;
    options.references = options.references || [];


    if (options.subtypeOf) {
      assert(options.subtypeOf);
      const subtypeOfNodeId = addressSpace._coerceType(options.subtypeOf,"References",NodeClass.ReferenceType);
      assert(subtypeOfNodeId);

      console.log(subtypeOfNodeId.toString().cyan);
      options.references.push({ referenceType: "HasSubtype", isForward: false,  nodeId: subtypeOfNodeId });
    }
    const node =  addressSpace._createNode(options);

    node.propagate_back_references();

    return node;
  }
}

AddressSpace.registry  = new (require("lib/misc/objectRegistry").ObjectRegistry)();


function _registerObjectType(self, node) {
  const key = node.browseName.toString();
  assert(!self._objectTypeMap[key], " UAObjectType already declared");
  self._objectTypeMap[key] = node;
}
function _unregisterObjectType() {}

function _registerVariableType(self, node) {
  const key = node.browseName.toString();
  assert(!self._variableTypeMap[key], " UAVariableType already declared");
  self._variableTypeMap[key] = node;
}

function _registerReferenceType(self, node) {
  assert(node.browseName instanceof QualifiedName);
  const key = node.browseName.toString();
  assert(node.inverseName.text);
  assert(!self._referenceTypeMap[key], " Node already declared");
  assert(!self._referenceTypeMapInv[node.inverseName], " Node already declared");
  self._referenceTypeMap[key] = node;
  self._referenceTypeMapInv[node.inverseName.text] = node;
}

function _registerDataType(self, node) {
  const key = node.browseName.toString();
  assert(node.browseName instanceof QualifiedName);
  assert(!self._dataTypeMap[key], " DataType already declared");
  self._dataTypeMap[key] = node;
}


const _constructors_map = {
  Object:        UAObject,
  ObjectType:    UAObjectType,
  ReferenceType,
  Variable:      UAVariable,
  VariableType:  UAVariableType,
  DataType:      UADataType,
  Method:        UAMethod,
  View
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
  }
  return str.substring(0, 2) === "i=" || str.substring(0, 3) === "ns=";
}
AddressSpace.isNodeIdString = isNodeIdString;

function isValidModellingRule(ruleName) {
    // let restrict to Mandatory or Optional for the time being
  return ruleName === null || ruleName === "Mandatory" || ruleName === "Optional";
}

/**
 * @method _process_modelling_rule
 * @param references {Array<Reference>} the array of references
 * @param modellingRule {Reference} the modellling Rule reference.
 * @private
 */
AddressSpace._process_modelling_rule = (references, modellingRule) => {
  if (modellingRule) {
    assert(isValidModellingRule(modellingRule), "expecting a valid modelling rule");
    const modellingRuleName = `ModellingRule_${modellingRule}`;
        // assert(self.findNode(modellingRuleName),"Modelling rule must exist");
    references.push({ referenceType: "HasModellingRule", nodeId: modellingRuleName });
  }
};


function __combineNodeId(parentNodeId,name) {
  let nodeId = null;
  if (parentNodeId.identifierType === NodeId.NodeIdType.STRING) {
    nodeId = resolveNodeId(`ns=1;s=${parentNodeId.value}-${name}`);
  }
  return nodeId;
}


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
    assert(!options.notifierOf , "notifierOf shall not be provided with eventSourceOf ");
    references.push({ referenceType: "HasEventSource", isForward: false, nodeId: options.eventSourceOf.nodeId });
  } else if (options.notifierOf) {
    assert(!options.eventSourceOf , "eventSourceOf shall not be provided with notifierOf ");
    references.push({ referenceType: "HasNotifier", isForward: false, nodeId: options.notifierOf.nodeId });
  }
}

function _handle_hierarchy_parent(addressSpace, references, options) {
  options.componentOf = _coerce_parent(addressSpace, options.componentOf, addressSpace._coerceNode);
  options.propertyOf  = _coerce_parent(addressSpace, options.propertyOf,  addressSpace._coerceNode);
  options.organizedBy = _coerce_parent(addressSpace, options.organizedBy, addressSpace._coerceFolder);

  if (options.componentOf) {
    assert(!options.propertyOf);
    assert(!options.organizedBy);
    assert(addressSpace.rootFolder.objects,"addressSpace must have a rootFolder.objects folder");
    assert(options.componentOf.nodeId !== addressSpace.rootFolder.objects.nodeId,"Only Organizes References are used to relate Objects to the 'Objects' standard Object.");
    references.push({ referenceType: "HasComponent", isForward: false, nodeId: options.componentOf.nodeId });
  }

  if (options.propertyOf) {
    assert(!options.componentOf);
    assert(!options.organizedBy);
    assert(options.propertyOf.nodeId !== addressSpace.rootFolder.objects.nodeId,"Only Organizes References are used to relate Objects to the 'Objects' standard Object.");

    references.push({ referenceType: "HasProperty", isForward: false, nodeId: options.propertyOf.nodeId });
  }

  if (options.organizedBy) {
    assert(!options.propertyOf);
    assert(!options.componentOf);
    references.push({ referenceType: "Organizes", isForward: false, nodeId: options.organizedBy.nodeId });
  }
}

AddressSpace._handle_hierarchy_parent = _handle_hierarchy_parent;

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


function _handle_node_version(node,options) {
  assert(options);
  if (options.nodeVersion) {
    assert(node.nodeClass === NodeClass.Variable || node.nodeClass === NodeClass.Object);
    const addressSpace = node.addressSpace;

    const nodeVersion = addressSpace.addVariable({
      propertyOf: node,
      browseName: "NodeVersion",
      dataType: "String"
    });
    const initialValue = _.isString(options.nodeVersion) ? options.nodeVersion : "0";
        // xx console.log(" init value =",initialValue);
    nodeVersion.setValueFromSource({ dataType: "String", value: initialValue });
  }
}

function _increase_version_number(node) {
  if (node && node.nodeVersion) {
    const previousValue = parseInt(node.nodeVersion.readValue().value.value);
    node.nodeVersion.setValueFromSource({ dataType: "String", value: (previousValue + 1).toString() });
        // xx console.log("xxx increasing version number of node ", node.browseName.toString(),previousValue);
  }
}

address_space_add_event_type_install(AddressSpace);
address_space_add_method_install(AddressSpace);
address_space_browse_install(AddressSpace);
address_space_construct_extension_object_install(AddressSpace);
ua_two_state_variable_install(AddressSpace);

// State Machines
address_space_state_machine_install(AddressSpace);

// HA
address_space_historical_data_node_install(AddressSpace);

// DI
address_space_add_AnalogItem_install(AddressSpace);
address_space_add_MultiStateDiscrete_install(AddressSpace);
address_space_add_TwoStateDiscrete_install(AddressSpace);
address_space_add_MultiStateValueDiscrete_install(AddressSpace);
address_space_add_YArrayItem_install(AddressSpace);
address_space_add_enumeration_type_install(AddressSpace);

alarms_and_conditions_install(AddressSpace);


export { AddressSpace };
