/**
 * @module opcua.address_space
 */
require("requirish")._(module);

var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var makeNodeId  = require("lib/datamodel/nodeid").makeNodeId;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;
var s = require("lib/datamodel/structures");


var DataValue = require("lib/datamodel/datavalue").DataValue;
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;

var browse_service = require("lib/services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

var BaseNode = require("lib/address_space/basenode").BaseNode;
var Variable = require("lib/address_space/variable").Variable;
var ReferenceType= require("lib/address_space/referenceType").ReferenceType;

var assert  = require("better-assert");
var util = require("util");
var _ = require("underscore");
var dumpIf = require("lib/misc/utils").dumpIf;





function Method(options) {

    BaseNode.apply(this, arguments);
    // assert(this.typeDefinition.value === resolveNodeId("MethodType").value);
    this.value = options.value;
    this.methodDeclarationId = options.methodDeclarationId ;

}
util.inherits(Method, BaseNode);
Method.prototype.nodeClass = NodeClass.Method;

Method.prototype.readAttribute = function (attributeId) {

    var options = {};
    switch (attributeId) {
        case AttributeIds.Executable:
            console.log(" warning Executable not implemented");
            options.value = { dataType: DataType.UInt32, value: 0 };
            options.statusCode = StatusCodes.BadAttributeIdInvalid;
            break;
        case AttributeIds.UserExecutable:
            console.log(" warning UserExecutable not implemented");
            options.value = { dataType: DataType.UInt32, value: 0 };
            options.statusCode = StatusCodes.BadAttributeIdInvalid;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this,attributeId);
    }
    return new DataValue(options);
};

var Argument = require("_generated_/_auto_generated_Argument").Argument;
Method.prototype._getInputArguments = function(name) {

    var argsVariable  = this.getPropertyByName(name);
    assert(argsVariable instanceof Variable);
    var args = argsVariable.get_variant().value;
    // a list of extension object
    assert(_.isArray(args));
    assert(args.length === 0 || args[0] instanceof Argument);
    return args;

};

Method.prototype.getInputArguments = function() {
    return this._getInputArguments("InputArguments");
};

Method.prototype.getOutputArguments = function() {
    return this._getInputArguments("OutputArguments");

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
 * @param callback
 */
Method.prototype.execute = function( inputArguments , context,callback) {
    assert(_.isArray(inputArguments));
    assert(_.isObject(context));
    assert(_.isFunction(callback));
    var self = this;
    if (!self._asyncExecutionFunction) {
        return callback(null, { statusCode: StatusCodes.BadInternalError});
    }
    // verify that input arguments are correct
    // todo :
    var inputArgumentResults= [];
    var inputArgumentDiagnosticInfos = [];

    self._asyncExecutionFunction(inputArguments,context,function(err,callMethodResponse) {

        if (!err) {
            assert(_.isArray(callMethodResponse.outputArguments)," _asyncExecution function error");
        }
        callMethodResponse.inputArgumentResults = inputArgumentResults;
        callMethodResponse.inputArgumentDiagnosticInfos = inputArgumentDiagnosticInfos;

        // verify that output arguments are correct according to schema
        // Todo : ...
        callback(err,callMethodResponse);

    });

};

exports.Method = Method;

