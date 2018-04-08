
const assert = require("node-opcua-assert").assert;
const _ = require("underscore");

const DataType = require("node-opcua-variant").DataType;
const Variant = require("node-opcua-variant").Variant;
const VariantArrayType = require("node-opcua-variant").VariantArrayType;

const add_dataItem_stuff = require("./UADataItem").add_dataItem_stuff;

const coerceLocalizedText = require("node-opcua-data-model").coerceLocalizedText;
const EnumValueType  = require("node-opcua-data-model").EnumValueType;


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
     * @method addMultiStateValueDiscrete
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
     *      addressSpace.addMultiStateValueDiscrete({
     *          componentOf:parentObj,
     *          browseName: "myVar",
     *          enumValues: {
     *              "Red":    0xFF0000,
     *              "Green":  0x00FF00,
     *              "Blue":   0x0000FF
     *          }
     *      });
     *      addMultiStateValueDiscrete(parentObj,{
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

    AddressSpace.prototype.addMultiStateValueDiscrete = function (options) {

        assert(options.hasOwnProperty("enumValues"));
        assert(!options.hasOwnProperty("ValuePrecision"));

        const addressSpace = this;

        const multiStateValueDiscreteType = addressSpace.findVariableType("MultiStateValueDiscreteType");
        assert(multiStateValueDiscreteType, "expecting MultiStateValueDiscreteType to be defined , check nodeset xml file");

        // todo : if options.typeDefinition is specified, check that type is SubTypeOf MultiStateDiscreteType

        // EnumValueType
        //   value: Int64, displayName: LocalizedText, Description: LocalizedText
        const enumValues = coerceEnumValues(options.enumValues);


        options.value = ( options.value === undefined) ? enumValues[0].value : options.value;

        let cloned_options = _.clone(options);
        cloned_options = _.extend(cloned_options,{
            typeDefinition: multiStateValueDiscreteType.nodeId,
            dataType:       "Number",
            // valueRank:
            // note : OPCUA Spec 1.03 specifies -1:Scalar (part 8 page 8) but nodeset file specifies -2:Any
            valueRank:       -1, // -1 : Scalar
            value:           new Variant({dataType: DataType.UInt32, value: options.value})
        });

        const variable = addressSpace.addVariable(cloned_options);

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
        const enumValueIndex = {};
        enumValues.forEach(function (e) {
            enumValueIndex[e.value[1]] = e;
        });


        variable.enumValues._index = enumValueIndex;

        function findValueAsText(value) {
            assert(!(value instanceof Variant));
            let valueAsText = "Invalid";
            if (enumValueIndex[value]) {
                valueAsText = enumValueIndex[value].displayName;
            }
            const result = new Variant({
                dataType: DataType.LocalizedText,
                value: coerceLocalizedText(valueAsText)
            });
            return result;

        }

        const valueAsText = findValueAsText(options.value);

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
                const valueAsText = findValueAsText(value.value.value);
                variable.valueAsText.setValueFromSource(valueAsText);
            });
        }

        install_synchronisation(variable);

        // replace clone
        const old_clone = variable.clone;
        assert(_.isFunction(old_clone));

        function new_clone() {
            const self = this;
            const variable = old_clone.apply(self, arguments);
            install_synchronisation(variable);
            return variable;
        }

        variable.clone = new_clone;

        assert(variable.enumValues.browseName.toString() === "EnumValues");
        assert(variable.valueAsText.browseName.toString() === "ValueAsText");
        return variable;

    };
};