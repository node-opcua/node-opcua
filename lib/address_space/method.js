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

var BaseNode = require("lib/address_space/basenode").BaseNode;
var Variable = require("lib/address_space/variable").Variable;

var assert  = require("better-assert");
var util = require("util");
var _ = require("underscore");





function Method(options) {

    BaseNode.apply(this, arguments);
    // assert(this.typeDefinition.value === resolveNodeId("MethodType").value);
    this.value = options.value;
    this.methodDeclarationId = options.methodDeclarationId ;

}
util.inherits(Method, BaseNode);
Method.prototype.nodeClass = NodeClass.Method;


Method.prototype.getExecutableFlag = function() {
    return _.isFunction(this._asyncExecutionFunction);
};

Method.prototype.readAttribute = function (attributeId) {

    var self = this;
    var options = {};
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
            return BaseNode.prototype.readAttribute.call(this,attributeId);
    }
    return new DataValue(options);
};

var Argument = require("_generated_/_auto_generated_Argument").Argument;
Method.prototype._getArguments = function(name) {

    var argsVariable  = this.getPropertyByName(name);
    assert(argsVariable);
    assert(argsVariable instanceof Variable);

    var args = argsVariable.readValue().value.value;

    // a list of extension object
    assert(_.isArray(args));
    assert(args.length === 0 || args[0] instanceof Argument);
    return args;

};

Method.prototype.getInputArguments = function() {
    return this._getArguments("InputArguments");
};

Method.prototype.getOutputArguments = function() {
    return this._getArguments("OutputArguments");

};


Method.prototype.bindMethod = function( async_func) {
    assert(_.isFunction(async_func));
    var self = this;
    self._asyncExecutionFunction = async_func;
};

/**
 * @method execute
 * @async
 * @param inputArguments
 * @param context
 * @param callback
 * @async
 */
Method.prototype.execute = function( inputArguments, context, callback) {
    assert(_.isArray(inputArguments));
    assert(_.isObject(context));
    assert(_.isFunction(callback));
    var self = this;

    if (!self.getExecutableFlag()) {
        // todo : find the correct Status code to return here
        return callback(null, { statusCode: StatusCodes.BadInternalError});
    }
    if (!self._asyncExecutionFunction) {
        return callback(null, { statusCode: StatusCodes.BadInternalError});
    }
    // verify that input arguments are correct
    // todo :
    var inputArgumentResults= [];
    var inputArgumentDiagnosticInfos = [];

    self._asyncExecutionFunction(inputArguments,context,function(err,callMethodResponse) {

        callMethodResponse.inputArgumentResults = inputArgumentResults;
        callMethodResponse.inputArgumentDiagnosticInfos = inputArgumentDiagnosticInfos;

        // verify that output arguments are correct according to schema
        // Todo : ...
        callback(err,callMethodResponse);

    });

};

exports.Method = Method;

