/**
 * @module opcua.address_space
 * @class AddressSpace
 */
import assert from "better-assert";
import _ from "underscore";
import { NodeClass } from "lib/datamodel/nodeclass";
import { Argument } from "lib/datamodel/argument_list";
import { DataValue } from "lib/datamodel/datavalue";
import { Variant } from "lib/datamodel/variant";
import { DataType } from "lib/datamodel/variant";
import { VariantArrayType } from "lib/datamodel/variant";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { BrowseDirection } from "lib/services/browse_service";
import UAVariable from "lib/address_space/UAVariable";
import UATwoStateVariable from './UATwoStateVariable';
import util from "util";

function _install_TwoStateVariable_machinery(node,options) {
  assert(node.dataTypeObj.browseName.toString() === "LocalizedText");
  assert(node.minimumSamplingInterval === 0);
  assert(node.typeDefinitionObj.browseName.toString() === "TwoStateVariableType");
  assert(node.dataTypeObj.browseName.toString() === "LocalizedText");
  assert(node.hasOwnProperty("valueRank") && (node.valueRank === -1 || node.valueRank === 0));
  assert(node.hasOwnProperty("id"));
  options = options || {};
    // promote node into a UATwoStateVariable
  Object.setPrototypeOf(node, UATwoStateVariable.prototype);
  node.initialize(options);
}


function install(AddressSpace) {
  assert(_.isUndefined(AddressSpace._install_TwoStateVariable_machinery));
  AddressSpace._install_TwoStateVariable_machinery = _install_TwoStateVariable_machinery;

    /**
     *
     * @method addTwoStateVariable
     *
     * @param options
     * @param options.browseName  {String}
     * @param [options.description {String}]
     * @param [options.modellingRule {String}]
     * @param [options.minimumSamplingInterval {Number} =0]
     * @param options.componentOf {Node|NodeId}
     * @param options.propertyOf {Node|NodeId}
     * @param options.trueState {String}
     * @param options.falseState {String}
     * @param [options.isTrueSubStateOf {NodeId}]
     * @param [options.isFalseSubStateOf {NodeId}]
     * @param [options.modellingRule]
     * @return {UATwoStateVariable}
     *
     * Optionals can be EffectiveDisplayName, TransitionTime, EffectiveTransitionTime
     */
  AddressSpace.prototype.addTwoStateVariable   = function (options) {
    assert(options.browseName," a browseName is required");
    const addressSpace = this;

    const twoStateVariableType = addressSpace.findVariableType("TwoStateVariableType");

    options.optionals = options.optionals || [];
    if (options.trueState) {
      options.optionals.push("TrueState");
    }
    if (options.falseState) {
      options.optionals.push("FalseState");
    }

        // we want event based change...
    options.minimumSamplingInterval = 0;

    const node = twoStateVariableType.instantiate({
      browseName: options.browseName,

      nodeId: options.nodeId,

      description: options.description,

      organizedBy: options.organizedBy,
      componentOf: options.componentOf,

      modellingRule: options.modellingRule,

      minimumSamplingInterval: options.minimumSamplingInterval,
      optionals: options.optionals
    });

    _install_TwoStateVariable_machinery(node,options);

    return node;
  };
}

export default install;

