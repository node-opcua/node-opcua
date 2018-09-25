"use strict";
const assert = require("node-opcua-assert").assert;
const DataType = require("node-opcua-variant").DataType;
const Variant = require("node-opcua-variant").Variant;

const add_dataItem_stuff = require("./UADataItem").add_dataItem_stuff;

const coerceLocalizedText = require("node-opcua-data-model").coerceLocalizedText;


module.exports.install = function (AddressSpace) {

    const Namespace = require("../namespace").Namespace;
    /**
     * @method addTwoStateDiscrete
     * @param options {Object}
     * @param options.browseName {String}
     * @param [options.nodeId  {NodeId}]
     * @param [options.value {Boolean} }
     * @param [options.trueState {String} = "ON" }
     * @param [options.falseState {String}= "OFF" }
     * @return {Object|UAVariable}
     */
    AddressSpace.prototype.addTwoStateDiscrete = function (options) {
        return this._resolveRequestedNamespace(options).addTwoStateDiscrete(options);
    };

    Namespace.prototype.addTwoStateDiscrete = function (options) {
        const namespace = this;
        const addressSpace = namespace.addressSpace;

        assert(!options.hasOwnProperty("ValuePrecision"));

        const twoStateDiscreteType = addressSpace.findVariableType("TwoStateDiscreteType");
        assert(twoStateDiscreteType, "expecting TwoStateDiscreteType to be defined , check nodeset xml file");


        // todo : if options.typeDefinition is specified,

        const variable = namespace.addVariable({
            componentOf: options.componentOf,
            browseName: options.browseName,
            nodeId: options.nodeId,
            typeDefinition: twoStateDiscreteType.nodeId,
            dataType: "Boolean",
            accessLevel: options.accessLevel,
            userAccessLevel: options.userAccessLevel,
            value: new Variant({dataType: DataType.Boolean, value: !!options.value})
        });

        const handler = variable.handle_semantic_changed.bind(variable);

        add_dataItem_stuff(variable, options);

        const trueStateNode = namespace.addVariable({
            propertyOf: variable,
            typeDefinition: "PropertyType",
            browseName: {name: "TrueState", namespaceIndex: 0},
            dataType: "LocalizedText",
            minimumSamplingInterval: 0,
            value: new Variant({
                dataType: DataType.LocalizedText, value: coerceLocalizedText(options.trueState || "ON")
            })
        });

        trueStateNode.on("value_changed", handler);

        const falseStateNode =  namespace.addVariable({
            propertyOf: variable,
            typeDefinition: "PropertyType",
            browseName: {name: "FalseState", namespaceIndex: 0},
            dataType: "LocalizedText",
            minimumSamplingInterval: 0,
            value: new Variant({
                dataType: DataType.LocalizedText, value: coerceLocalizedText(options.falseState || "OFF")
            })
        });

        falseStateNode.on("value_changed", handler);

        variable.install_extra_properties();

        return variable;
    };

};
