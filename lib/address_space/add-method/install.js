/**
 * @module opcua.address_space
 * @class AddressSpace
 */
import assert from "better-assert";
import _ from "underscore";
import { NodeClass } from "lib/datamodel/nodeclass";
import { Argument } from "lib/datamodel/argument_list";
import { DataValue } from "lib/datamodel/datavalue";
import { Variant, DataType, VariantArrayType } from "lib/datamodel/variant";

/* eslint-disable no-param-reassign */
function install(AddressSpace) {
  const isNonEmptyQualifiedName = AddressSpace.isNonEmptyQualifiedName;
  const _handle_hierarchy_parent = AddressSpace._handle_hierarchy_parent;

  AddressSpace.prototype._addMethod = function _addMethod(options) {
    const self = this;

    assert(isNonEmptyQualifiedName(options.browseName));

    const references = [];
    assert(isNonEmptyQualifiedName(options.browseName));

    _handle_hierarchy_parent(self, references, options);

    AddressSpace._process_modelling_rule(references, options.modellingRule);

    const method = self._createNode({
      nodeClass: NodeClass.Method,
      nodeId: options.nodeId,
      isAbstract: false,
      browseName: options.browseName,
      description: options.description || "",
      eventNotifier: +options.eventNotifier,
      references
    });
    assert(method.nodeId !== null);
    method.propagate_back_references();
    assert(!method.typeDefinition);

    return method;
  };

  /**
   * @method addMethod
   * @param parentObject {Object}
   * @param options {Object}
   * @param [options.nodeId=null] {NodeId} the object nodeid.
   * @param [options.browseName=""] {String} the object browse name.
   * @param [options.description=""] {String} the object description.
   * @param options.inputArguments  {Array<Argument>}
   * @param options.outputArguments {Array<Argument>}
   * @return {Object}
   */
  AddressSpace.prototype.addMethod = function addMethod(parentObject, options) {
    const self = this;

    assert(_.isObject(parentObject));

    options.nodeClass = NodeClass.Method;

    assert(Object.prototype.hasOwnProperty.call(options, "browseName"));
    assert(!Object.prototype.hasOwnProperty.call(options, "inputArguments") || _.isArray(options.inputArguments));
    assert(!Object.prototype.hasOwnProperty.call(options, "outputArguments") || _.isArray(options.outputArguments));

    options.componentOf = parentObject;

    const method = self._addMethod(options);

    const propertyTypeId = self._coerce_VariableTypeIds("PropertyType");

    const nodeId_ArgumentDataType = "Argument"; // makeNodeId(DataTypeIds.Argument);

    if (options.inputArguments) {
      const _inputArgs = new Variant({
        dataType: DataType.ExtensionObject,
        arrayType: VariantArrayType.Array,
        value: options.inputArguments.map(opt => new Argument(opt))
      });

      const inputArguments = self.addVariable({
        modellingRule: "Mandatory",
        propertyOf: method,
        typeDefinition: "PropertyType",
        browseName: "InputArguments",
        description: `the definition of the input argument of method ${parentObject.browseName.toString()}.${method.browseName.toString()}`,
        dataType: nodeId_ArgumentDataType,
        accessLevel: "CurrentRead",
        valueRank: 1,
        minimumSamplingInterval: -1,
        arrayDimensions: [_inputArgs.value.length],
        value: _inputArgs
      });
      inputArguments.setValueFromSource(_inputArgs);
      assert(inputArguments.typeDefinition.toString() === propertyTypeId.toString());
      // xx console.log(
      //  "xxxx propertyTypeId = ",
      //  propertyTypeId,
      //  outputArguments.hasTypeDefinition
      // );
      assert(_.isArray(inputArguments.arrayDimensions));
    }


    if (options.outputArguments) {
      const _ouputArgs = new Variant({
        dataType: DataType.ExtensionObject,
        arrayType: VariantArrayType.Array,
        value: options.outputArguments.map(opts => new Argument(opts))
      });

      const outputArguments = self.addVariable({
        modellingRule: "Mandatory",
        propertyOf: method,
        typeDefinition: "PropertyType",
        browseName: "OutputArguments",
        description: `the definition of the output arguments of method ${parentObject.browseName.toString()}.${method.browseName.toString()}`,
        dataType: nodeId_ArgumentDataType,
        accessLevel: "CurrentRead",
        valueRank: 1,
        minimumSamplingInterval: -1,
        arrayDimensions: [_ouputArgs.value.length],
        value: _ouputArgs
      });
      outputArguments.setValueFromSource(_ouputArgs);

      assert(outputArguments.typeDefinition.toString() === propertyTypeId.toString());
      assert(_.isArray(outputArguments.arrayDimensions));
    }

    // verifying post-conditions
    parentObject.install_extra_properties();

    return method;
  };
}

export default install;
