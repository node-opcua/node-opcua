"use strict";

/**
 * @module opcua.address_space
 */
require("requirish")._(module);

var NodeClass = require("lib/datamodel/nodeclass").NodeClass;


var DataValue = require("lib/datamodel/datavalue").DataValue;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;

var BaseNode = require("lib/address_space/base_node").BaseNode;
var UAVariable = require("lib/address_space/ua_variable").UAVariable;
var Variant = require("lib/datamodel/variant").Variant;

var SessionContext = require("lib/server/session_context").SessionContext;

var assert = require("better-assert");
var util = require("util");
var _ = require("underscore");


function UAMethod(options) {

    BaseNode.apply(this, arguments);
    // assert(this.typeDefinition.value === resolveNodeId("MethodType").value);
    this.value = options.value;
    this.methodDeclarationId = options.methodDeclarationId;

}
util.inherits(UAMethod, BaseNode);
UAMethod.prototype.nodeClass = NodeClass.Method;


UAMethod.prototype.getExecutableFlag = function (context) {
    assert(context instanceof SessionContext);
    if (!_.isFunction(this._asyncExecutionFunction)) {
        return false;
    }
    if (this._getExecutableFlag) {
        return this._getExecutableFlag(context);
    }
    return true;
};

UAMethod.prototype.readAttribute = function (context, attributeId) {

    assert(context instanceof SessionContext);

    var self = this;
    var options = {};
    switch (attributeId) {
        case AttributeIds.Executable:
            options.value = {dataType: DataType.Boolean, value: self.getExecutableFlag(context)};
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.UserExecutable:
            options.value = {dataType: DataType.Boolean, value: self.getExecutableFlag(context)};
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this, context, attributeId);
    }
    return new DataValue(options);
};

var Argument = require("_generated_/_auto_generated_Argument").Argument;
UAMethod.prototype._getArguments = function (name) {

    assert(name === "InputArguments" || name === "OutputArguments");
    var argsVariable = this.getPropertyByName(name);
    if (!argsVariable) { return [];}

    assert(argsVariable instanceof UAVariable);

    var args = argsVariable.readValue().value.value;

    // a list of extension object
    assert(_.isArray(args));
    assert(args.length === 0 || args[0] instanceof Argument);
    return args;

};

UAMethod.prototype.getInputArguments = function () {
    return this._getArguments("InputArguments");
};

UAMethod.prototype.getOutputArguments = function () {
    return this._getArguments("OutputArguments");

};

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
UAMethod.prototype.bindMethod = function (async_func) {
    assert(_.isFunction(async_func));
    var self = this;
    self._asyncExecutionFunction = async_func;
};


/**
 * @method execute
 * @async
 * @param context  {SessionContext}
 * @param inputArguments {Variant[]} input arguments as array of variant
 * @param context
 * @param callback
 * @async
 */
UAMethod.prototype.execute = function (inputArguments, context, callback) {
    assert(_.isArray(inputArguments));
    assert(context instanceof SessionContext);
    inputArguments = inputArguments.map(Variant.coerce);
    assert(inputArguments.length === 0 || inputArguments[0] instanceof Variant);
    assert(_.isObject(context));
    assert(_.isFunction(callback));
    var self = this;

    // a context object must be provided
    if (!context.object) {
        context.object = self.parent;
    }

    assert(context.object instanceof BaseNode);

    //xx inputArguments = inputArguments.map(function(a) { return Variant.coerce(a); });
    //xx inputArguments.forEach(function(arg){ assert(arg instanceof Variant); });

    if (!self._asyncExecutionFunction) {
        console.log("Method " + self.nodeId.toString() + " " + self.browseName.toString() + "_ has not been bound");

        return callback(null, {statusCode: StatusCodes.BadInternalError});
    }

    if (!self.getExecutableFlag(context)) {
        console.log("Method " + self.nodeId.toString() + " " + self.browseName.toString() + "_ is not executable");
        // todo : find the correct Status code to return here
        return callback(null, {statusCode: StatusCodes.BadMethodInvalid});
    }
    // verify that input arguments are correct
    // todo :
    var inputArgumentResults = [];
    var inputArgumentDiagnosticInfos = [];

    try {
        self._asyncExecutionFunction(inputArguments, context, function (err, callMethodResponse) {

            callMethodResponse = callMethodResponse || {};

            callMethodResponse.statusCode = callMethodResponse.statusCode || StatusCodes.Good;
            callMethodResponse.outputArguments = callMethodResponse.outputArguments || [];

            callMethodResponse.inputArgumentResults = inputArgumentResults;
            callMethodResponse.inputArgumentDiagnosticInfos = inputArgumentDiagnosticInfos;

            // verify that output arguments are correct according to schema
            // Todo : ...
            var outputArgsDef = self.getOutputArguments();

            //xx assert(outputArgsDef.length === callMethodResponse.outputArguments.length,
            //xx     "_asyncExecutionFunction did not provide the expected number of output arguments");
            // to be continued ...


            callback(err, callMethodResponse);

        });

    } catch(err){
        console.log("ERR in method  handler".red,err.message);
        console.error(err.stack);
        var callMethodResponse = { statusCode: StatusCodes.BadInternalError};
        callback(err, callMethodResponse);

    }

};

UAMethod.prototype.clone = function (options,optionalfilter,extraInfo) {

    var self = this;
    options = options || {};
    options = _.extend(_.clone(options),{
        methodDeclarationId: self.nodeId
    });
    var clonedMethod =  self._clone(UAMethod,options, optionalfilter, extraInfo);
    clonedMethod._asyncExecutionFunction = self._asyncExecutionFunction;
    clonedMethod._getExecutableFlag = self._getExecutableFlag;
    return clonedMethod;
};
exports.UAMethod = UAMethod;

