"use strict";
var assert = require("node-opcua-assert");

var Variant = require("node-opcua-variant").Variant;
var DataType = require("node-opcua-variant").DataType;

var StatusCodes = require("node-opcua-status-code").StatusCodes;

var Range = require("node-opcua-data-access").Range;


var UAVariable = require("../ua_variable").UAVariable;

function validate_value_range(range, variant) {
    assert(range instanceof Range);
    assert(variant instanceof Variant);
    if (variant.value < range.low || variant.value > range.high) {
        return false;
    }
    return true;
}

UAVariable.prototype.isValueInRange = function (value) {

    assert(value instanceof Variant);
    var self = this;
    // test dataType
    if (!self._validate_DataType(value.dataType)) {
        return  StatusCodes.BadTypeMismatch;
    }

    // AnalogDataItem
    if (self.instrumentRange) {
        if (!validate_value_range(self.instrumentRange.readValue().value.value, value)) {
            return StatusCodes.BadOutOfRange;
        }
    }

    // MultiStateDiscreteType
    if (self.enumStrings) {
        var arrayEnumStrings = self.enumStrings.readValue().value.value;
        // MultiStateDiscreteType
        assert(value.dataType === DataType.UInt32);
        if(value.value >= arrayEnumStrings.length) {
            return StatusCodes.BadOutOfRange;
        }
    }

    // MultiStateValueDiscreteType
    if (self.enumValues && self.enumValues._index) {

        var e = self.enumValues._index[value.value];
        if (!e) {
            return StatusCodes.BadOutOfRange;
        }
    }

    return StatusCodes.Good;
};