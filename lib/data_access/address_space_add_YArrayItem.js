/* jslint bitwise: true */
import _ from "underscore";
import { DataValue } from "lib/datamodel/datavalue";
import { Variant } from "lib/datamodel/variant";
import { DataType } from "lib/datamodel/variant";
import { NodeId } from "lib/datamodel/nodeid";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { AttributeIds } from "lib/services/read_service";
import { BaseNode } from "lib/address_space/base_node";
import { 
  AxisInformation,
  AxisScale,
  Range
} from "lib/datamodel/part_8_structures";


import { isNullOrUndefined } from "lib/misc/utils";

import assert from "better-assert";
import { VariantArrayType } from "lib/datamodel/variant";
import { coerceLocalizedText } from "lib/datamodel/localized_text";

function install(AddressSpace) {
    /**
     *
     * @method addYArrayItem
     * @param options
     * @param options.componentOf {NodeId}
     * @param options.browseName {String}
     * @param options.title {String}
     * @param [options.instrumentRange]
     * @param [options.instrumentRange.low] {Double}
     * @param [options.instrumentRange.high] {Double}
     * @param options.engineeringUnitsRange.low {Double}
     * @param options.engineeringUnitsRange.high {Double}
     * @param options.engineeringUnits {String}
     * @param [options.nodeId = {NodeId}]
     * @param options.accessLevel
     * @param options.userAccessLevel
     * @param options.title {String}
     * @param options.axisScaleType {AxisScaleEnumeration}
     *
     * @param options.xAxisDefinition {AxisInformation}
     * @param options.xAxisDefinition.engineeringUnits {EURange}
     * @param options.xAxisDefinition.range
     * @param options.xAxisDefinition.range.low
     * @param options.xAxisDefinition.range.high
     * @param options.xAxisDefinition.title  {LocalizedText}
     * @param options.xAxisDefinition.axisScaleType {AxisScaleEnumeration}
     * @param options.xAxisDefinition.axisSteps = <null>  {Array<Double>}
     * @param options.value
     */
  AddressSpace.prototype.addYArrayItem = function (options) {
    assert(options.hasOwnProperty("engineeringUnitsRange"), "expecting engineeringUnitsRange");
    assert(options.hasOwnProperty("axisScaleType"), "expecting axisScaleType");
    assert(_.isObject(options.xAxisDefinition), "expecting a xAxisDefinition");

    const addressSpace = this;

    const YArrayItemType = addressSpace.findVariableType("YArrayItemType");
    assert(YArrayItemType, "expecting YArrayItemType to be defined , check nodeset xml file");

    const dataType = options.dataType || "Float";

    const optionals = [];
    if (options.hasOwnProperty("instrumentRange")) {
      optionals.push("InstrumentRange");
    }
    const variable = YArrayItemType.instantiate({
      componentOf: options.componentOf,
      browseName: options.browseName,
      dataType,
      optionals
    });

    function coerceAxisScale(value) {
      const ret = AxisScale.get(value);
      assert(!isNullOrUndefined(ret));
      return ret;
    }

    variable.setValueFromSource(options.value, StatusCodes.Good);


    variable.euRange.setValueFromSource(new Variant({
      dataType: DataType.ExtensionObject, value: new Range(options.engineeringUnitsRange)
    }));

    if (options.hasOwnProperty("instrumentRange")) {
      variable.instrumentRange.setValueFromSource(new Variant({
        dataType: DataType.ExtensionObject, value: new Range(options.instrumentRange)
      }));
    }

    variable.title.setValueFromSource(new Variant({
      dataType: DataType.LocalizedText, value: coerceLocalizedText(options.title || "")
    }));

        // Linear/Log/Ln
    variable.axisScaleType.setValueFromSource(new Variant({
      dataType: DataType.Int32, value: coerceAxisScale(options.axisScaleType)
    }));

    variable.xAxisDefinition.setValueFromSource(new Variant({
      dataType: DataType.ExtensionObject, value: new AxisInformation(options.xAxisDefinition)
    }));

    return variable;
  };
}
export { install };
