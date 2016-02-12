require("requirish")._(module);
var assert = require("better-assert");
var address_space = require("lib/address_space/address_space");
var DataType = require("lib/datamodel/variant").DataType;
var Variant = require("lib/datamodel/variant").Variant;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;

var add_dataItem_stuff = require("./UADataItem").add_dataItem_stuff;
var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;

var _ = require("underscore");

module.exports.install = function(AddressSpace) {

    /**
     *
     * @method addMultiStateDiscreteType
     * @param options {Object}
     * @param options.browseName {String}
     * @param [options.nodeId  {NodeId}]
     * @param [options.value {UInt32} = 0 ]
     * @param options.enumStrings {String[]} an array containing the String associated with each enumeration value, starting from 0 onward
     * @return {Object|UAVariable}
     */
    AddressSpace.prototype.addMultiStateDiscreteType = function(options) {

        assert(options.hasOwnProperty("enumStrings"));
        assert(!options.hasOwnProperty("ValuePrecision"));

        var addressSpace = this;
        assert(addressSpace instanceof AddressSpace);

        var multiStateDiscreteType = addressSpace.findVariableType("MultiStateDiscreteType");
        assert(multiStateDiscreteType, "expecting MultiStateDiscreteType to be defined , check nodeset xml file");

        // todo : if options.typeDefinition is specified, check that type is SubTypeOf MultiStateDiscreteType

        options.value = ( options.value === undefined) ? 0 : options.value;

        var variable = addressSpace.addVariable(_.extend(options,{
            typeDefinition: multiStateDiscreteType.nodeId,
            dataType: "UInteger",
            valueRank: -2,
            value: new Variant({ dataType: DataType.UInt32, value: options.value })
        }));

        add_dataItem_stuff(variable,options);

        var enumStrings = options.enumStrings.map(function(value) {
            return coerceLocalizedText(value)
        });

        addressSpace.addVariable({
            modellingRule: options.modellingRule ? "Mandatory" : undefined,
            propertyOf: variable,
            typeDefinition: "PropertyType",
            browseName: "EnumStrings",
            dataType: "LocalizedText",
            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentRead",
            minimumSamplingInterval: 0,
            value:  new Variant({
                dataType: DataType.LocalizedText,
                arrayType: VariantArrayType.Array,
                value: enumStrings
            }),
            modellingRule: options.modellingRule ? "Mandatory" : undefined
        });

        variable.install_extra_properties();

        assert(variable.enumStrings.browseName.toString() === "EnumStrings");
        return variable;

    };
};

