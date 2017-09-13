"use strict";
/*jslint bitwise: true */

var _ = require("underscore");
var DataValue =  require("node-opcua-data-value").DataValue;
var Variant = require("node-opcua-variant").Variant;
var DataType = require("node-opcua-variant").DataType;
var NodeId = require("node-opcua-nodeid").NodeId;
var StatusCodes = require("node-opcua-status-code").StatusCodes;
var AttributeIds = require("node-opcua-data-model").AttributeIds;
var BaseNode = require("../base_node").BaseNode;


var part8 = require("node-opcua-data-access");

var AxisInformation = part8.AxisInformation;
var AxisScale       = part8.AxisScale;
var Range           = part8.Range;

var utils = require("node-opcua-utils");
var assert = require("node-opcua-assert");
var VariantArrayType = require("node-opcua-variant").VariantArrayType;
var coerceLocalizedText = require("node-opcua-data-model").coerceLocalizedText;


module.exports.install = function(AddressSpace) {
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

        var addressSpace = this;

        var YArrayItemType = addressSpace.findVariableType("YArrayItemType");
        assert(YArrayItemType, "expecting YArrayItemType to be defined , check nodeset xml file");

        var dataType = options.dataType || "Float";

        var optionals = [];
        if (options.hasOwnProperty("instrumentRange")) {
            optionals.push("InstrumentRange");
        }
        var variable = YArrayItemType.instantiate({
            componentOf: options.componentOf,
            browseName: options.browseName,
            dataType: dataType,
            optionals: optionals
        });

        function coerceAxisScale(value) {
            var ret = AxisScale.get(value);
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