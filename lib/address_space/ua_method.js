/**
 * @module opcua.address_space
 */

import { NodeClass } from "lib/datamodel/nodeclass";
import { DataValue } from "lib/datamodel/datavalue";
import { DataType } from "lib/datamodel/variant";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { AttributeIds } from "lib/services/read_service";

import { BaseNode } from "lib/address_space/base_node";
import UAVariable from "lib/address_space/UAVariable";
import { Variant } from "lib/datamodel/variant";
import assert from "better-assert";
import util from "util";
import _ from "underscore";


class UAMethod extends BaseNode {
  constructor(options) {
    super(...arguments);
      // assert(this.typeDefinition.value === resolveNodeId("MethodType").value);
    this.value = options.value;
    this.methodDeclarationId = options.methodDeclarationId;
  }

  getExecutableFlag() {
    if (!_.isFunction(this._asyncExecutionFunction)) {
      return false;
    }
    if (this._getExecutableFlag) {
      return this._getExecutableFlag();
    }
    return true;
  }

  readAttribute(attributeId) {
    const self = this;
    const options = {};
    switch (attributeId) {
      case AttributeIds.Executable:
        options.value = { dataType: DataType.Boolean, value: self.getExecutableFlag() };
        options.statusCode = StatusCodes.Good;
        break;
      case AttributeIds.UserExecutable:
        options.value = { dataType: DataType.Boolean, value: self.getExecutableFlag() };
        options.statusCode = StatusCodes.Good;
        break;
      default:
        return BaseNode.prototype.readAttribute.call(this, attributeId);
    }
    return new DataValue(options);
  }

  _getArguments(name) {
    assert(name === "InputArguments" || name === "OutputArguments");
    const argsVariable = this.getPropertyByName(name);
    if (!argsVariable) { return []; }

    assert(argsVariable instanceof UAVariable);

    const args = argsVariable.readValue().value.value;

      // a list of extension object
    assert(_.isArray(args));
    assert(args.length === 0 || args[0] instanceof Argument);
    return args;
  }

  getInputArguments() {
    return this._getArguments("InputArguments");
  }

  getOutputArguments() {
    return this._getArguments("OutputArguments");
  }

  /**
   * @method bindMethod
   * @param async_func {Function}
   * @param async_func.inputArguments
   * @param async_func.context
   * @param async_func.callback {Function}
   * @param async_func.callback.err {Error|null}
   * @param async_func.callback.callMethodResponse.statusCode {StatusCode}
   * @param async_func.callback.callMethodResponse.outputArguments {Variant[]}
   */
  bindMethod(async_func) {
    assert(_.isFunction(async_func));
    const self = this;
    self._asyncExecutionFunction = async_func;
  }

  /**
   * @method execute
   * @async
   * @param inputArguments {Variant[]} input arguments as array of variant
   * @param context
   * @param callback
   * @async
   */
  execute(inputArguments, context, callback) {
    assert(_.isArray(inputArguments));
    inputArguments = inputArguments.map(Variant.coerce);
    assert(inputArguments.length === 0 || inputArguments[0] instanceof Variant);
    assert(_.isObject(context));
    assert(_.isFunction(callback));
    const self = this;

      // a context object must be provided
    if (!context.object) {
      context.object = self.parent;
    }

    assert(context.object instanceof BaseNode);

      // xx inputArguments = inputArguments.map(function(a) { return Variant.coerce(a); });
      // xx inputArguments.forEach(function(arg){ assert(arg instanceof Variant); });

    if (!self._asyncExecutionFunction) {
      console.log(`Method ${self.nodeId.toString()} ${self.browseName.toString()}_ has not been bound`);

      return callback(null, { statusCode: StatusCodes.BadInternalError });
    }

    if (!self.getExecutableFlag()) {
      console.log(`Method ${self.nodeId.toString()} ${self.browseName.toString()}_ is not executable`);
          // todo : find the correct Status code to return here
      return callback(null, { statusCode: StatusCodes.BadMethodInvalid });
    }
      // verify that input arguments are correct
      // todo :
    const inputArgumentResults = [];
    const inputArgumentDiagnosticInfos = [];

    try {
      self._asyncExecutionFunction(inputArguments, context, (err, callMethodResponse) => {
        callMethodResponse = callMethodResponse || {};

        callMethodResponse.statusCode = callMethodResponse.statusCode || StatusCodes.Good;
        callMethodResponse.outputArguments = callMethodResponse.outputArguments || [];

        callMethodResponse.inputArgumentResults = inputArgumentResults;
        callMethodResponse.inputArgumentDiagnosticInfos = inputArgumentDiagnosticInfos;

              // verify that output arguments are correct according to schema
              // Todo : ...
        const outputArgsDef = self.getOutputArguments();

              // xx assert(outputArgsDef.length === callMethodResponse.outputArguments.length,
              // xx     "_asyncExecutionFunction did not provide the expected number of output arguments");
              // to be continued ...


        callback(err, callMethodResponse);
      });
    } catch (err) {
      console.log("ERR in method  handler".red,err.message);
      console.error(err.stack);
      const callMethodResponse = { statusCode: StatusCodes.BadInternalError };
      callback(err, callMethodResponse);
    }
  }

  clone(options, optionalfilter, extraInfo) {
    const self = this;
    options = options || {};
    options = _.extend(_.clone(options),{
      methodDeclarationId: self.nodeId
    });
    const clonedMethod =  self._clone(UAMethod,options, optionalfilter, extraInfo);
    clonedMethod._asyncExecutionFunction = self._asyncExecutionFunction;
    clonedMethod._getExecutableFlag = self._getExecutableFlag;
    return clonedMethod;
  }
}

UAMethod.prototype.nodeClass = NodeClass.Method;


import { Argument } from "_generated_/_auto_generated_Argument";
export { UAMethod };

