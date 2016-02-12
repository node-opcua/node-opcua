"use strict";
/**
 * @module opcua.address_space
 * @class AddressSpace
 */
require("requirish")._(module);
var assert = require("better-assert");
var _ = require("underscore");
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var Argument = require("lib/datamodel/argument_list").Argument;
var DataValue = require("lib/datamodel/datavalue").DataValue;
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;

exports.install = function (AddressSpace) {

    var isNonEmptyQualifiedName = AddressSpace.isNonEmptyQualifiedName;
    var _handle_hierarchy_parent = AddressSpace._handle_hierarchy_parent;

    AddressSpace.prototype._addMethod = function(options) {

        var self = this;

        assert(isNonEmptyQualifiedName(options.browseName));

        var references = [];
        assert(isNonEmptyQualifiedName(options.browseName));

        _handle_hierarchy_parent(self, references, options);

        AddressSpace._process_modelling_rule(references, options.modellingRule);

        var method = self._createNode({
            nodeClass: NodeClass.Method,
            isAbstract: false,
            browseName: options.browseName,
            description: options.description || "",
            eventNotifier: +options.eventNotifier,
            references: references
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
    AddressSpace.prototype.addMethod = function (parentObject, options) {
        var self = this;

        assert(_.isObject(parentObject));

        options.nodeClass = NodeClass.Method;

        assert(options.hasOwnProperty("browseName"));
        assert(options.hasOwnProperty("inputArguments") && _.isArray(options.inputArguments));
        assert(options.hasOwnProperty("outputArguments") && _.isArray(options.outputArguments));

        options.componentOf = parentObject;

        var method = self._addMethod(options);


        var nodeId_ArgumentDataType = "Argument"; // makeNodeId(DataTypeIds.Argument);

        var _inputArgs = new Variant({
            dataType: DataType.ExtensionObject,
            arrayType: VariantArrayType.Array,
            value: options.inputArguments.map(function (opt) {
                return new Argument(opt);
            })
        });

        var inputArguments = self.addVariable({
            propertyOf: method,
            typeDefinition: "PropertyType",
            browseName: "InputArguments",
            description: "the definition of the input argument of method " + parentObject.browseName.toString() + "." + method.browseName.toString(),
            dataType: nodeId_ArgumentDataType,
            accessLevel: "CurrentRead",
            valueRank: 1,
            minimumSamplingInterval: -1,
            arrayDimensions: [_inputArgs.value.length],
            value: _inputArgs
        });
        inputArguments.setValueFromSource(_inputArgs);

        parentObject.install_extra_properties();

        var _ouputArgs = new Variant({
            dataType: DataType.ExtensionObject,
            arrayType: VariantArrayType.Array,
            value: options.outputArguments.map(function (opts) {
                return new Argument(opts);
            })
        });

        var outputArguments = self.addVariable({
            propertyOf: method,
            typeDefinition: "PropertyType",
            browseName: "OutputArguments",
            description: "the definition of the output arguments of method " + parentObject.browseName.toString() + "." + method.browseName.toString(),
            dataType: nodeId_ArgumentDataType,
            accessLevel: "CurrentRead",
            valueRank: 1,
            minimumSamplingInterval: -1,
            arrayDimensions: [_ouputArgs.value.length],
            value: _ouputArgs
        });
        outputArguments.setValueFromSource(_ouputArgs);

        // verifying post-conditions
        var propertyTypeId = self._coerce_VariableTypeIds("PropertyType");

        //xx console.log("xxxx propertyTypeId = ", propertyTypeId, outputArguments.hasTypeDefinition);
        assert(outputArguments.typeDefinition.toString() === propertyTypeId.toString());
        assert(inputArguments.typeDefinition.toString() === propertyTypeId.toString());
        assert(_.isArray(inputArguments.arrayDimensions));
        assert(_.isArray(outputArguments.arrayDimensions));

        return method;
    };

};
