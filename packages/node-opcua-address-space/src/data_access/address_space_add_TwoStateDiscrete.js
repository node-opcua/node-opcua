
var assert = require("node-opcua-assert");
var address_space = require("../address_space");
var DataType = require("node-opcua-variant").DataType;
var Variant = require("node-opcua-variant").Variant;

var add_dataItem_stuff = require("./UADataItem").add_dataItem_stuff;

var coerceLocalizedText = require("node-opcua-data-model").coerceLocalizedText;

module.exports.install = function(AddressSpace) {

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
    AddressSpace.prototype.addTwoStateDiscrete = function(options) {

        var addressSpace = this;

        assert(!options.hasOwnProperty("ValuePrecision"));

        var twoStateDiscreteType = addressSpace.findVariableType("TwoStateDiscreteType");
        assert(twoStateDiscreteType, "expecting TwoStateDiscreteType to be defined , check nodeset xml file");


        // todo : if options.typeDefinition is specified,

        var variable = addressSpace.addVariable({
            componentOf:     options.componentOf,
            browseName:      options.browseName,
            nodeId:          options.nodeId,
            typeDefinition:  twoStateDiscreteType.nodeId,
            dataType:        "Boolean",
            accessLevel:     options.accessLevel,
            userAccessLevel: options.userAccessLevel,
            value: new Variant({dataType: DataType.Boolean, value: !!options.value})
        });

        var handler = variable.handle_semantic_changed.bind(variable);

        add_dataItem_stuff(variable, options);

        var trueStateNode = addressSpace.addVariable({
            propertyOf:        variable,
            typeDefinition:   "PropertyType",
            browseName:       "TrueState",
            dataType:         "LocalizedText",
            minimumSamplingInterval: 0,
            value: new Variant({
                dataType: DataType.LocalizedText, value: coerceLocalizedText(options.trueState || "ON")
            })
        });

        trueStateNode.on("value_changed",handler);

        var falseStateNode = addressSpace.addVariable({
            propertyOf:       variable,
            typeDefinition:   "PropertyType",
            browseName:       "FalseState",
            dataType:         "LocalizedText",
            minimumSamplingInterval: 0,
            value: new Variant({
                dataType: DataType.LocalizedText, value: coerceLocalizedText(options.falseState || "OFF")
            })
        });

        falseStateNode.on("value_changed",handler);

        variable.install_extra_properties();

        return variable;
    };

};
