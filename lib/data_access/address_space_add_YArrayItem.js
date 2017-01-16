/*jslint bitwise: true */
require("requirish")._(module);
const _ = require("underscore");
const DataValue = require("lib/datamodel/datavalue").DataValue;
const Variant = require("lib/datamodel/variant").Variant;
const DataType = require("lib/datamodel/variant").DataType;
const NodeId = require("lib/datamodel/nodeid").NodeId;
const StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
const read_service = require("lib/services/read_service");
const AttributeIds = read_service.AttributeIds;
const BaseNode = require("lib/address_space/base_node").BaseNode;


const part8 = require("lib/datamodel/part_8_structures");

const AxisInformation = part8.AxisInformation;
const AxisScale       = part8.AxisScale;
const Range           = part8.Range;

const utils = require("lib/misc/utils");
const assert = require("better-assert");
const VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
const coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;


module.exports.install = AddressSpace => {
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
            assert(!utils.isNullOrUndefined(ret));
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

};