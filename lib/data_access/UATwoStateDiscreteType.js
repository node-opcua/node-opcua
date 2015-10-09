require("requirish")._(module);
var assert = require("assert");
var address_space = require("lib/address_space/address_space");
var AddressSpace = address_space.AddressSpace;
var DataType = require("lib/datamodel/variant").DataType;
var Variant = require("lib/datamodel/variant").Variant;

var add_dataItem_stuff = require("./UADataItem").add_dataItem_stuff;

var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;

/**
 * @method addTwoStateDiscreteType
 * @param parentObject
 * @param options {Object}
 * @param options.browseName {String}
 * @param [options.nodeId  {NodeId}]
 * @param [options.value {Boolean} }
 * @param [options.trueState {String} = "ON" }
 * @param [options.falseState {String}= "OFF" }
 * @returns {Object|UAVariable}
 */
function addTwoStateDiscreteType(parentObject, options) {

    assert(!options.hasOwnProperty("ValuePrecision"));
    var address_space = parentObject.__address_space;
    assert(address_space instanceof AddressSpace);

    var twoStateDiscreteType = address_space.findVariableType("TwoStateDiscreteType");
    assert(twoStateDiscreteType, "expecting TwoStateDiscreteType to be defined , check nodeset xml file");

    // todo : if options.typeDefinition is specified,

    var variable = address_space.addVariable(parentObject, {
        browseName: options.browseName,
        nodeId: options.nodeId,
        typeDefinition: twoStateDiscreteType.nodeId,
        dataType: "Boolean",
        accessLevel: options.accessLevel,
        userAccessLevel: options.userAccessLevel,
        value: new Variant({ dataType: DataType.Boolean, value: !!options.value })
    });

    add_dataItem_stuff(variable,options);

    address_space.addProperty(variable, {
        browseName: "TrueState",
        typeDefinition: "PropertyType",
        dataType: "LocalizedText",
        minimumSamplingInterval: 0,
        value:  new Variant({
            dataType: DataType.LocalizedText, value: coerceLocalizedText(options.trueState || "ON")
        })
    });

    address_space.addProperty(variable, {
        browseName: "FalseState",
        typeDefinition: "PropertyType",
        dataType: "LocalizedText",
        minimumSamplingInterval: 0,
        value:  new Variant({
            dataType: DataType.LocalizedText, value: coerceLocalizedText(options.falseState || "OFF")
        })
    });

    variable.install_extra_properties();

    return variable;
}
exports.addTwoStateDiscreteType = addTwoStateDiscreteType;
