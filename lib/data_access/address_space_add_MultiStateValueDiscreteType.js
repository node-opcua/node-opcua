require("requirish")._(module);
var assert = require("better-assert");
var _ = require("underscore");

var DataType = require("lib/datamodel/variant").DataType;
var Variant = require("lib/datamodel/variant").Variant;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;

var add_dataItem_stuff = require("./UADataItem").add_dataItem_stuff;

var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;
var EnumValueType = require("_generated_/_auto_generated_EnumValueType").EnumValueType;

var _ = require("underscore");

function coerceEnumValues(enumValues) {

    if (_.isArray(enumValues)) {

        //
        return _.map(enumValues, function (en) {
            assert(en.hasOwnProperty("value"));
            assert(en.hasOwnProperty("displayName"));
            return new EnumValueType({
                value: en.value,
                displayName: coerceLocalizedText(en.displayName)
            });
        })
    } else {
        return coerceEnumValues(_.map(enumValues, function (value, key) {

            return new EnumValueType({
                value: value,
                displayName: coerceLocalizedText(key),
                description: coerceLocalizedText(key)
            });
        }));
    }
}

module.exports.install = function (AddressSpace) {

    /**
     *
     * @method addMultiStateValueDiscreteType
     * @param options {Object}
     * @param options.browseName {String}
     * @param [options.nodeId  {NodeId}]
     * @param [options.value {UInt32} = 0 }
     * @param options.enumValues { EnumValueType[]| {Key,Value} }
     * @return {Object|UAVariable}
     *
     * @example
     *
     *
     *      addressSpace.addMultiStateValueDiscreteType({
     *          componentOf:parentObj,
     *          browseName: "myVar",
     *          enumValues: {
     *              "Red":    0xFF0000,
     *              "Green":  0x00FF00,
     *              "Blue":   0x0000FF
     *          }
     *      });
     *      addMultiStateValueDiscreteType(parentObj,{
     *          browseName: "myVar",
     *          enumValues: [
     *              {
     *                 value: 0xFF0000,
     *                 displayName: "Red",
     *                 description: " The color Red"
     *              },
     *              {
     *                 value: 0x00FF000,
     *                 displayName: "Green",
     *                 description: " The color Green"
     *              },
     *              {
     *                 value: 0x0000FF,
     *                 displayName: "Blue",
     *                 description: " The color Blue"
     *              }
     *
     *          ]
     *      });
     */

    AddressSpace.prototype.addMultiStateValueDiscreteType = function (options) {

        assert(options.hasOwnProperty("enumValues"));
        assert(!options.hasOwnProperty("ValuePrecision"));

        var addressSpace = this;

        var multiStateValueDiscreteType = addressSpace.findVariableType("MultiStateValueDiscreteType");
        assert(multiStateValueDiscreteType, "expecting MultiStateValueDiscreteType to be defined , check nodeset xml file");

        // todo : if options.typeDefinition is specified, check that type is SubTypeOf MultiStateDiscreteType

        // EnumValueType
        //   value: Int64, displayName: LocalizedText, Description: LocalizedText
        var enumValues = coerceEnumValues(options.enumValues);


        options.value = ( options.value === undefined) ? enumValues[0].value : options.value;

        var cloned_options = _.clone(options);
        cloned_options = _.extend(cloned_options,{
            typeDefinition: multiStateValueDiscreteType.nodeId,
            dataType:       "Number",
            // valueRank:
            // note : OPCUA Spec 1.03 specifies -1:Scalar (part 8 page 8) but nodeset file specifies -2:Any
            valueRank:       -1, // -1 : Scalar
            value:           new Variant({dataType: DataType.UInt32, value: options.value})
        });

        var variable = addressSpace.addVariable(cloned_options);

        add_dataItem_stuff(variable, options);


        addressSpace.addVariable({
            propertyOf: variable,
            typeDefinition: "PropertyType",
            browseName: "EnumValues",
            dataType: "EnumValueType",
            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentRead",
            minimumSamplingInterval: 0,
            value: new Variant({
                dataType: DataType.ExtensionObject,
                arrayType: VariantArrayType.Array,
                value: enumValues
            }),
            modellingRule: options.modellingRule ? "Mandatory" : undefined

        });

        // construct an index to quickly find a EnumValue from a value
        var enumValueIndex = {};
        enumValues.forEach(function (e) {
            enumValueIndex[e.value[1]] = e;
        });


        variable.enumValues._index = enumValueIndex;

        function findValueAsText(value) {
            assert(!(value instanceof Variant));
            var valueAsText = "Invalid";
            if (enumValueIndex[value]) {
                valueAsText = enumValueIndex[value].displayName;
            }
            var result = new Variant({
                dataType: DataType.LocalizedText,
                value: coerceLocalizedText(valueAsText)
            });
            return result;

        }

        var valueAsText = findValueAsText(options.value);

        addressSpace.addVariable({
            propertyOf: variable,
            typeDefinition: "PropertyType",
            browseName: "ValueAsText",
            dataType: "LocalizedText",
            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentRead",
            minimumSamplingInterval: 0,
            value: valueAsText,
            modellingRule: options.modellingRule ? "Mandatory" : undefined
        });

        // install additional helpers methods
        variable.install_extra_properties();


        function install_synchronisation(variable) {
            variable.on("value_changed", function (value, indexRange) {
                var valueAsText = findValueAsText(value.value.value);
                variable.valueAsText.setValueFromSource(valueAsText);
            });
        }

        install_synchronisation(variable);

        // replace clone
        var old_clone = variable.clone;
        assert(_.isFunction(old_clone));

        function new_clone() {
            var self = this;
            var variable = old_clone.apply(self, arguments);
            install_synchronisation(variable);
            return variable;
        }

        variable.clone = new_clone;

        assert(variable.enumValues.browseName.toString() === "EnumValues");
        assert(variable.valueAsText.browseName.toString() === "ValueAsText");
        return variable;

    };
};