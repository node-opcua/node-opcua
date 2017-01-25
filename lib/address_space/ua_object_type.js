/**
 * @module opcua.address_space
 */
import assert from "better-assert";
import { NodeClass } from "lib/datamodel/nodeclass";
import { DataValue } from "lib/datamodel/datavalue";
import { DataType } from "lib/datamodel/variant";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { AttributeIds } from "lib/services/read_service";
import _ from "underscore";
import util from "util";
import { isNullOrUndefined } from "lib/misc/utils";
import { BaseNode } from "lib/address_space/base_node";
import { construct_isSupertypeOf } from "./tool_isSupertypeOf";

/**
 * @class UAObjectType
 * @param options
 * @constructor
 */
class UAObjectType extends BaseNode {
  constructor(options) {
    super(...arguments);
    this.isAbstract = isNullOrUndefined(options.isAbstract) ? false : options.isAbstract;
  }

  readAttribute(attributeId) {
    const options = {};
    switch (attributeId) {
      case AttributeIds.IsAbstract:
        options.value = { dataType: DataType.Boolean, value: !!this.isAbstract };
        options.statusCode = StatusCodes.Good;
        break;
      default:
        return BaseNode.prototype.readAttribute.call(this, attributeId);
    }
    return new DataValue(options);
  }

  /**
   * instantiate an object of this UAObjectType
   * The instantiation takes care of object type inheritance when constructing inner properties and components.
   * @method instantiate
   * @param options
   * @param options.browseName {String}
   * @param [options.description]
   * @param [options.organizedBy] {String|NodeId|UANode} the parent Folder holding this object
   * @param [options.componentOf] {String|NodeId|UANode} the parent Object holding this object
   * @param [options.notifierOf] {NodeId|UANode}
   * @param [options.eventSourceOf] {NodeId|UANode}
   * @param [options.optionals = [] {Array<String>] ] name of the optional child to create
   * @param [options.modellingRule] {String}
   *
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
   */
  instantiate(options) {
    const self = this;
    const addressSpace = self.addressSpace;
    assert(!self.isAbstract, "cannot instantiate abstract UAObjectType");

    assert(options, "missing option object");
    assert(_.isString(options.browseName), "expecting a browse name");

    assert(!options.hasOwnProperty("propertyOf"),"an Object shall not be a PropertyOf an other object");
    assert(!options.hasOwnProperty("optional"),"do you mean optionals ?");

    assertUnusedChildBrowseName(addressSpace,options);

    const baseObjectType = addressSpace.findObjectType("BaseObjectType");
    assert(baseObjectType, "BaseObjectType must be defined in the address space");


    const references = [];

    const opts = {
      browseName:     options.browseName,
      description:    options.description || self.description,
      references,
      componentOf:    options.componentOf,
      organizedBy:    options.organizedBy,
      notifierOf:     options.notifierOf,
      eventSourceOf:  options.eventSourceOf,
      typeDefinition: self.nodeId,

      nodeId: options.nodeId,

      modellingRule : options.modellingRule
    };

    const instance = addressSpace.addObject(opts);

    initialize_properties_and_components(instance, baseObjectType,self, options.optionals);

    assert(instance.typeDefinition.toString() === self.nodeId.toString());

    instance.install_extra_properties();

    if (self._postInstantiateFunc) {
      self._postInstantiateFunc(instance,self,options);
    }

    return instance;
  }
}

UAObjectType.prototype.nodeClass = NodeClass.ObjectType;

UAObjectType.prototype.isSupertypeOf = construct_isSupertypeOf(UAObjectType);


import initialize_properties_and_components from "./ua-variable-type/initialize_properties_and_components";
import assertUnusedChildBrowseName from "./ua-variable-type/assertUnusedChildBrowseName";

export { UAObjectType };
