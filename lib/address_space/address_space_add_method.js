"use strict";
require("requirish")._(module);
var assert = require("better-assert");
var _ = require("underscore");
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var Argument = require("lib/datamodel/argument_list").Argument;
var DataValue = require("lib/datamodel/datavalue").DataValue;
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;

var AddressSpace = require("lib/address_space/address_space").AddressSpace;

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
AddressSpace.prototype.addMethod = function (parentObject, options) {
    var self = this;

    assert(_.isObject(parentObject));

    if (typeof parentObject === "string"){
        parentObject = self.getFolder(parentObject);
    }

    var newNodeId = options.nodeId || self._build_new_NodeId();
    options.nodeId = newNodeId;
    options.nodeClass = NodeClass.Method;

    assert(options.hasOwnProperty("browseName"));
    assert(options.hasOwnProperty("inputArguments") && _.isArray(options.inputArguments));
    assert(options.hasOwnProperty("outputArguments") && _.isArray(options.outputArguments));

    var method = self.addObjectInFolder(parentObject, options);

    var nodeId_ArgumentDataType = "Argument"; // makeNodeId(DataTypeIds.Argument);

    var _inputArgs = new Variant({
        dataType: DataType.ExtensionObject,
        arrayType: VariantArrayType.Array,
        value: options.inputArguments.map(function (options) {
            return new Argument(options);
        })
    });

    var inputArguments = self.addProperty(method, {
        typeDefinition: "PropertyType",
        browseName: "InputArguments",
        description: "the definition of the input argument of method " + parentObject.browseName + "." + method.browseName,
        nodeId: self._build_new_NodeId(),
        dataType: nodeId_ArgumentDataType,
        accessLevel: "CurrentRead",
        valueRank: 1,
        minimumSamplingInterval: -1,
        arrayDimensions: [_inputArgs.value.length],
        value:  _inputArgs
    });
    inputArguments.setValueFromSource(_inputArgs);

    var _ouputArgs = new Variant({
        dataType: DataType.ExtensionObject,
        arrayType: VariantArrayType.Array,
        value: options.outputArguments.map(function (options) {
            return new Argument(options);
        })
    });

    var outputArguments = self.addProperty(method, {
        typeDefinition: "PropertyType",
        browseName: "OutputArguments",
        description: "the definition of the output arguments of method " + parentObject.browseName + "." + method.browseName,
        nodeId: self._build_new_NodeId(),
        dataType: nodeId_ArgumentDataType,
        accessLevel: "CurrentRead",
        valueRank: 1,
        minimumSamplingInterval: -1,
        arrayDimensions: [_ouputArgs.value.length],
        value:  _ouputArgs
    });
    outputArguments.setValueFromSource(_ouputArgs);

    // verifying postconditions
    var propertyTypeId = self._coerce_VariableTypeIds("PropertyType");

    console.log(" propertyTypeId = ", propertyTypeId, outputArguments.hasTypeDefinition);
    assert(outputArguments.hasTypeDefinition.toString() === propertyTypeId.toString());
    assert(inputArguments.hasTypeDefinition.toString() === propertyTypeId.toString());
    assert(_.isArray(inputArguments.arrayDimensions));
    assert(_.isArray(outputArguments.arrayDimensions));

    return method;
};

