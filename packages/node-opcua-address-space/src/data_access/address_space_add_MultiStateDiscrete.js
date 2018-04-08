
const assert = require("node-opcua-assert").assert;
const util = require("util");
const address_space = require("../address_space");
const DataType = require("node-opcua-variant").DataType;
const Variant = require("node-opcua-variant").Variant;
const VariantArrayType = require("node-opcua-variant").VariantArrayType;

const add_dataItem_stuff = require("./UADataItem").add_dataItem_stuff;
const coerceLocalizedText = require("node-opcua-data-model").coerceLocalizedText;

const _ = require("underscore");


const UAVariable = require("../ua_variable").UAVariable;
/**
 * @class UAMultiStateDiscreteType
 * @constructor
 */
function UAMultiStateDiscreteType() {

}
util.inherits(UAMultiStateDiscreteType,UAVariable);

UAMultiStateDiscreteType.prototype.getValue = function() {
    return this.readValue().value.value;
};

/**
 * @method getValueAsString
 * @return {String}
 */
UAMultiStateDiscreteType.prototype.getValueAsString = function() {

    const index = this.getValue();
    const arr = this.enumStrings.readValue().value.value;
    assert(_.isArray(arr));
    return arr[index].text.toString();
};

UAMultiStateDiscreteType.prototype.getIndex = function(value) {
    const arr = this.enumStrings.readValue().value.value;
    assert(_.isArray(arr));
    const index  = arr.findIndex(function(a) { return a.text === value;});

    return index;
};

UAMultiStateDiscreteType.prototype.setValue = function(value) {

    if (typeof(value) === "string") {
        const index = this.getIndex(value);
        assert(index>=0," invalid multi state value provided");
        return this.setValue(index);
    }
    assert(_.isFinite(value));
    return this.setValueFromSource(new Variant({ dataType: DataType.UInt32, value: value }));
};

module.exports.install = function(AddressSpace) {

    /**
     *
     * @method addMultiStateDiscrete
     * @param options {Object}
     * @param options.browseName {String}
     * @param [options.nodeId  {NodeId}]
     * @param [options.value {UInt32} = 0 ]
     * @param options.enumStrings {String[]} an array containing the String associated with each enumeration value, starting from 0 onward
     * @return {Object|UAVariable}
     */
    AddressSpace.prototype.addMultiStateDiscrete = function(options) {

        assert(options.hasOwnProperty("enumStrings"));
        assert(!options.hasOwnProperty("ValuePrecision"));

        const addressSpace = this;
        assert(addressSpace instanceof AddressSpace);

        const multiStateDiscreteType = addressSpace.findVariableType("MultiStateDiscreteType");
        assert(multiStateDiscreteType, "expecting MultiStateDiscreteType to be defined , check nodeset xml file");

        // todo : if options.typeDefinition is specified, check that type is SubTypeOf MultiStateDiscreteType

        options.value = ( options.value === undefined) ? 0 : options.value;

        const variable = addressSpace.addVariable(_.extend(options,{
            typeDefinition: multiStateDiscreteType.nodeId,
            dataType: "UInteger",
            valueRank: -2,
            value: new Variant({ dataType: DataType.UInt32, value: options.value })
        }));

        add_dataItem_stuff(variable,options);

        const enumStrings = options.enumStrings.map(function(value) {
            return coerceLocalizedText(value)
        });

        const enumStringsNode = addressSpace.addVariable({
            modellingRule: options.modellingRule ? "Mandatory" : undefined,
            propertyOf: variable,
            typeDefinition: "PropertyType",
            browseName: "EnumStrings",
            dataType: "LocalizedText",
            accessLevel: "CurrentRead", //| CurrentWrite",
            userAccessLevel: "CurrentRead",// CurrentWrite",
            minimumSamplingInterval: 0,
            value:  new Variant({
                dataType: DataType.LocalizedText,
                arrayType: VariantArrayType.Array,
                value: enumStrings
            })
        });

        const handler = variable.handle_semantic_changed.bind(variable);
        enumStringsNode.on("value_changed",handler);

        variable.install_extra_properties();

        assert(variable.enumStrings.browseName.toString() === "EnumStrings");

        Object.setPrototypeOf(variable, UAMultiStateDiscreteType.prototype);

        return variable;

    };
};

