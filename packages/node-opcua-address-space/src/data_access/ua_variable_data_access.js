"use strict";
const assert = require("node-opcua-assert").assert;

const Variant = require("node-opcua-variant").Variant;
const DataType = require("node-opcua-variant").DataType;

const StatusCodes = require("node-opcua-status-code").StatusCodes;

const Range = require("node-opcua-data-access").Range;


const UAVariable = require("../ua_variable").UAVariable;

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
    const self = this;
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
        const arrayEnumStrings = self.enumStrings.readValue().value.value;
        // MultiStateDiscreteType
        assert(value.dataType === DataType.UInt32);
        if(value.value >= arrayEnumStrings.length) {
            return StatusCodes.BadOutOfRange;
        }
    }

    // MultiStateValueDiscreteType
    if (self.enumValues && self.enumValues._index) {

        const e = self.enumValues._index[value.value];
        if (!e) {
            return StatusCodes.BadOutOfRange;
        }
    }

    return StatusCodes.Good;
};