/**
 * @module opcua.address_space
 */

import assert from "better-assert";
import util from "util";
import _ from "underscore";
import { BaseNode } from "lib/address_space/base_node";
import { coerceNodeId } from "lib/datamodel/nodeid";

import { construct_isSupertypeOf } from "../tool_isSupertypeOf";


import { NodeClass } from "lib/datamodel/nodeclass";
import { NodeId } from "lib/datamodel/nodeid";
import { makeNodeId } from "lib/datamodel/nodeid";
import { resolveNodeId } from "lib/datamodel/nodeid";
import { DataValue } from "lib/datamodel/datavalue";
import { Variant } from "lib/datamodel/variant";
import { DataType } from "lib/datamodel/variant";
import { VariantArrayType } from "lib/datamodel/variant";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { AttributeIds } from "lib/services/read_service";


import { 
  make_debugLog, 
  checkDebugFlag,
  isNullOrUndefined
} from "lib/misc/utils";
import { BrowseDirection } from "lib/services/browse_service";

import { sameNodeId } from "lib/datamodel/nodeid";
import { Reference } from "lib/address_space/reference";
import { makeOptionalsMap } from "lib/address_space/make_optionals_map";
import initialize_properties_and_components from "./initialize_properties_and_components";
import assertUnusedChildBrowseName from './assertUnusedChildBrowseName';

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);


function prepareDataType(dataType) {
  return coerceNodeId(dataType);
}


/**
 * @class UAVariableType
 * @extends  BaseNode
 * @param options
 * @constructor
 */
class UAVariableType extends BaseNode {
  constructor(options) {
    super(...arguments);
    const self = this;

    self.isAbstract = isNullOrUndefined(options.isAbstract) ? false : options.isAbstract;

    self.value = options.value;          // optional default value for instances of this UAVariableType

    self.dataType = prepareDataType(options.dataType);    // DataType (NodeId)

    self.valueRank = options.valueRank || 0;  // Int32

      // see OPC-UA part 5 : $3.7 Conventions for Node descriptions
    self.arrayDimensions = options.arrayDimensions || [];

    assert(_.isArray(this.arrayDimensions));

    if (options.value) {
      self.value = new Variant(options.value);
          // xx console.log("setting ",self.value.toString());
    }
  }

  readAttribute(attributeId) {
    const options = {};
    switch (attributeId) {
      case AttributeIds.IsAbstract:
        options.value = { dataType: DataType.Boolean, value: !!this.isAbstract };
        options.statusCode = StatusCodes.Good;
        break;
      case AttributeIds.Value:
        if (this.hasOwnProperty("value") && this.value !== undefined) {
          assert(this.value._schema.name === "Variant");
          options.value = this.value;
          options.statusCode = StatusCodes.Good;
        } else {
          debugLog(" warning Value not implemented");
          options.value = { dataType: DataType.UInt32, value: 0 };
          options.statusCode = StatusCodes.BadAttributeIdInvalid;
        }
        break;
      case AttributeIds.DataType:
        assert(this.dataType instanceof NodeId);
        options.value = { dataType: DataType.NodeId, value: this.dataType };
        options.statusCode = StatusCodes.Good;
        break;
      case AttributeIds.ValueRank:
        options.value = { dataType: DataType.Int32, value: this.valueRank };
        options.statusCode = StatusCodes.Good;
        break;
      case AttributeIds.ArrayDimensions:
        assert(_.isArray(this.arrayDimensions) || this.arrayDimensions === null);
        options.value = { dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: this.arrayDimensions };
        options.statusCode = StatusCodes.Good;
        break;
      default:
        return BaseNode.prototype.readAttribute.call(this, attributeId);
    }
    return new DataValue(options);
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
  instantiate(options) {
    const self = this;
    const addressSpace = self.addressSpace;
      // xx assert(!self.isAbstract, "cannot instantiate abstract UAVariableType");

    assert(options, "missing option object");
    assert(_.isString(options.browseName), "expecting a browse name");
    assert(!options.hasOwnProperty("propertyOf"),"Use addressSpace#addVariable({ propertyOf: xxx}); to add a property");

    assertUnusedChildBrowseName(addressSpace,options);

    const baseVariableType = addressSpace.findVariableType("BaseVariableType");
    assert(baseVariableType, "BaseVariableType must be defined in the address space");

    let dataType =  (options.dataType !== undefined) ? options.dataType  : self.dataType; // may be required (i.e YArrayItemType )
    dataType = self.resolveNodeId(dataType);    // DataType (NodeId)
    assert(dataType instanceof NodeId);

    const valueRank      = (options.valueRank !== undefined) ? options.valueRank : self.valueRank;
    const arrayDimensions = (options.arrayDimensions !== undefined) ? options.arrayDimensions : self.arrayDimensions;

      // istanbul ignore next
    if (!dataType || dataType.isEmpty()) {
      console.warn(" options.dataType" , options.dataType ? options.dataType.toString() : "<null>");
      console.warn(" self.dataType" , self.dataType ? self.dataType.toString() : "<null>");
      throw new Error(" A valid dataType must be specified");
    }


    const opts = {
      browseName:     options.browseName,
      description:    options.description || self.description,
      componentOf:    options.componentOf,
      organizedBy:    options.organizedBy,
      notifierOf:     options.notifierOf,
      eventSourceOf:  options.eventSourceOf,
      typeDefinition: self.nodeId,
      nodeId:         options.nodeId,
      dataType,
      valueRank,
      arrayDimensions,
      value:          options.value,
      modellingRule : options.modellingRule,
      minimumSamplingInterval: options.minimumSamplingInterval
    };

    const instance = addressSpace.addVariable(opts);


    initialize_properties_and_components(instance,baseVariableType,self,options.optionals);

      // if VariableType is a type of Structure DataType
      // we need to instantiate a dataValue
      // and create a bidirectional binding with the individual properties of this type
    instance.bindExtensionObject();


    assert(instance.typeDefinition.toString() === self.nodeId.toString());

    instance.install_extra_properties();
      
    if (self._postInstantiateFunc) {
      self._postInstantiateFunc(instance,self);
    }

    return instance;
  }
}

UAVariableType.prototype.nodeClass = NodeClass.VariableType;


UAVariableType.prototype.isSupertypeOf = construct_isSupertypeOf(UAVariableType);









export default  UAVariableType;

