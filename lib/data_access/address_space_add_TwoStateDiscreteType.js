require("requirish")._(module);
var assert = require("better-assert");
var address_space = require("lib/address_space/address_space");
var DataType = require("lib/datamodel/variant").DataType;
var Variant = require("lib/datamodel/variant").Variant;

var add_dataItem_stuff = require("./UADataItem").add_dataItem_stuff;

var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;

module.exports.install = function(AddressSpace) {

    /**
     * @method addTwoStateDiscreteType
     * @param options {Object}
     * @param options.browseName {String}
     * @param [options.nodeId  {NodeId}]
     * @param [options.value {Boolean} }
     * @param [options.trueState {String} = "ON" }
     * @param [options.falseState {String}= "OFF" }
     * @return {Object|UAVariable}
     */
    AddressSpace.prototype.addTwoStateDiscreteType = function(options) {

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

        add_dataItem_stuff(variable, options);

        addressSpace.addVariable({
            propertyOf:        variable,
            typeDefinition:   "PropertyType",
            browseName:       "TrueState",
            dataType:         "LocalizedText",
            minimumSamplingInterval: 0,
            value: new Variant({
                dataType: DataType.LocalizedText, value: coerceLocalizedText(options.trueState || "ON")
            })
        });

        addressSpace.addVariable({
            propertyOf:       variable,
            typeDefinition:   "PropertyType",
            browseName:       "FalseState",
            dataType:         "LocalizedText",
            minimumSamplingInterval: 0,
            value: new Variant({
                dataType: DataType.LocalizedText, value: coerceLocalizedText(options.falseState || "OFF")
            })
        });

        variable.install_extra_properties();

        return variable;
    };

};
