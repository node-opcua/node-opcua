import assert from "better-assert";
import util from "util";
import { DataType } from "lib/datamodel/variant";
import { Variant } from "lib/datamodel/variant";
import { VariantArrayType } from "lib/datamodel/variant";
import { add_dataItem_stuff } from "./UADataItem";
import { coerceLocalizedText } from "lib/datamodel/localized_text";
import _ from "underscore";
import { UAVariable } from "lib/address_space/ua_variable";

/**
 *
 * @constructor
 */
class UAMultiStateDiscreteType extends UAVariable {
  getValue() {
    return this.readValue().value.value;
  }

  getValueAsString() {
    const index = this.getValue();
    const arr = this.enumStrings.readValue().value.value;
    assert(_.isArray(arr));
    return arr[index].text.toString();
  }

  getIndex(value) {
    const arr = this.enumStrings.readValue().value.value;
    assert(_.isArray(arr));
    const index  = arr.findIndex(a => a.text === value);

    return index;
  }

  setValue(value) {
    if (typeof (value) === "string") {
      const index = this.getIndex(value);
      assert(index >= 0," invalid multi state value provided");
      return this.setValue(index);
    }
    assert(_.isFinite(value));
    return this.setValueFromSource(new Variant({ dataType: DataType.UInt32, value }));
  }
}

function install(AddressSpace) {
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
  AddressSpace.prototype.addMultiStateDiscrete = function (options) {
    assert(options.hasOwnProperty("enumStrings"));
    assert(!options.hasOwnProperty("ValuePrecision"));

    const addressSpace = this;
    assert(addressSpace instanceof AddressSpace);

    const multiStateDiscreteType = addressSpace.findVariableType("MultiStateDiscreteType");
    assert(multiStateDiscreteType, "expecting MultiStateDiscreteType to be defined , check nodeset xml file");

        // todo : if options.typeDefinition is specified, check that type is SubTypeOf MultiStateDiscreteType

    options.value = (options.value === undefined) ? 0 : options.value;

    const variable = addressSpace.addVariable(_.extend(options,{
      typeDefinition: multiStateDiscreteType.nodeId,
      dataType: "UInteger",
      valueRank: -2,
      value: new Variant({ dataType: DataType.UInt32, value: options.value })
    }));

    add_dataItem_stuff(variable,options);

    const enumStrings = options.enumStrings.map(value => coerceLocalizedText(value));

    const enumStringsNode = addressSpace.addVariable({
      modellingRule: options.modellingRule ? "Mandatory" : undefined,
      propertyOf: variable,
      typeDefinition: "PropertyType",
      browseName: "EnumStrings",
      dataType: "LocalizedText",
      accessLevel: "CurrentRead", // | CurrentWrite",
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
}

export { install };
