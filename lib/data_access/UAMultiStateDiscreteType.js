require("requirish")._(module);
var assert = require("better-assert");
var address_space = require("lib/address_space/address_space");
var AddressSpace = address_space.AddressSpace;
var DataType = require("lib/datamodel/variant").DataType;
var Variant = require("lib/datamodel/variant").Variant;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;

var add_dataItem_stuff = require("./UADataItem").add_dataItem_stuff;

var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;
/**
 *
 * @method addTwoStateDiscreteType
 * @param parentObject
 * @param options {Object}
 * @param options.browseName {String}
 * @param [options.nodeId  {NodeId}]
 * @param [options.value {UInt32} = 0 ]
 * @param options.enumStrings {String[]} an array containing the String associated with each enumeration value, starting from 0 onward
 * @returns {Object|UAVariable}
 */
exports.addMultiStateDiscreteType = function(parentObject,options) {

    assert(options.hasOwnProperty("enumStrings"));
    assert(!options.hasOwnProperty("ValuePrecision"));

    var address_space = parentObject.__address_space;
    assert(address_space instanceof AddressSpace);

    var multiStateDiscreteType = address_space.findVariableType("MultiStateDiscreteType");
    assert(multiStateDiscreteType, "expecting MultiStateDiscreteType to be defined , check nodeset xml file");

    // todo : if options.typeDefinition is specified, check that type is SubTypeOf MultiStateDiscreteType

    options.value = ( options.value === undefined) ? 0 : options.value;

    var variable = address_space.addVariable(parentObject, {
        browseName: options.browseName,
        nodeId: options.nodeId,
        typeDefinition: multiStateDiscreteType.nodeId,
        dataType: "UInteger",
        accessLevel: options.accessLevel,
        userAccessLevel: options.userAccessLevel,
        valueRank: -2,
        value: new Variant({ dataType: DataType.UInt32, value: options.value })
    });

    add_dataItem_stuff(variable,options);

    var enumStrings = options.enumStrings.map(function(value) {
        return coerceLocalizedText(value)
    });

    address_space.addProperty(variable, {
        browseName: "EnumStrings",
        typeDefinition: "PropertyType",
        dataType: "LocalizedText",
        accessLevel: "CurrentRead",
        userAccessLevel: "CurrentRead",
        minimumSamplingInterval: 0,
        value:  new Variant({
            dataType: DataType.LocalizedText,
            arrayType: VariantArrayType.Array,
            value: enumStrings
        })
    });

    variable.install_extra_properties();

    assert(variable.enumStrings.browseName.toString() === "EnumStrings");
    return variable;

};
