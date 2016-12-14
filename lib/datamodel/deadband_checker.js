require("requirish")._(module);
var subscription_service = require("lib/services/subscription_service");
var DeadbandType = subscription_service.DeadbandType;
var DataType = require("lib/datamodel/variant").DataType;
var Variant = require("lib/datamodel/variant").Variant;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var assert = require("better-assert");
var _ = require("underscore");

function _differenceScalar(value1,value2,dataType,absoluteDeadband) {

    if (dataType === DataType.UInt64 || dataType === DataType.Int64) {

        var h1 = value1[0]; // high
        var h2 = value2[0];
        if (h1 !== h2 ) {
            var diff = (h1 - h2) * 4294967295;
            if (Math.abs(diff) > absoluteDeadband) {
                return true;
            }
        }
        diff =  value1[1] - value2[1];
        assert(_.isNumber(diff)&& _.isFinite(diff));
        return Math.abs(diff) > absoluteDeadband;
    }
    diff =  value2 -value1;
    assert(_.isNumber(diff)&& _.isFinite(diff));

    return Math.abs(diff) > absoluteDeadband;

}

function difference(v1,v2,absoluteDeadband) {

    assert(_.isFinite(absoluteDeadband));

    if (v1.arrayType === VariantArrayType.Array) {

        if (v1.dataType !== v2.dataType) {
            return true;
        }
        if (v1.value.length !== v2.value.length) {
            return true;
        }

        var n = v1.value.length;
        var i =0;
        for (i=0;i<n;i++) {
            if (_differenceScalar(v1.value[i],v2.value[i],v1.dataType,absoluteDeadband)) {
                return true;
            }
        }
        return false;

    } else {
        assert(v1.arrayType === VariantArrayType.Scalar);
        assert(v1.dataType === v2.dataType);
        return _differenceScalar(v1.value,v2.value,v1.dataType,absoluteDeadband);
    }
}

/**
 * detect true
 * @param variant1 {Variant}
 * @param variant2 {Variant}
 * @param deadbandType  {DeadbandType}
 * @param deadbandValue {Float}
 * @param valueRange    {Float}
 * @return {boolean}
 */
function check_deadband(variant1,variant2,deadbandType,deadbandValue,valueRange) {


    switch (deadbandType) {

        case DeadbandType.None:
            // No Deadband calculation should be applied.
            return difference(variant1, variant2, 0);

        case DeadbandType.Absolute:
            // AbsoluteDeadband
            return difference(variant1,variant2,deadbandValue);

        default:
            // Percent_2    PercentDeadband (This type is specified in Part 8).
            assert(deadbandType === DeadbandType.Percent);

            // The range of the deadbandValue is from 0.0 to 100.0 Percent.
            assert(deadbandValue >= 0 && deadbandValue <= 100);

            // DeadbandType = PercentDeadband
            // For this type of deadband the deadbandValue is defined as the percentage of the EURange. That is,
            // it applies only to AnalogItems with an EURange Property that defines the typical value range for the
            // item. This range shall be multiplied with the deadbandValue and then compared to the actual value change
            // to determine the need for a data change notification. The following pseudo code shows how the deadband
            // is calculated:
            //      DataChange if (absolute value of (last cached value - current value) >
            //                                          (deadbandValue/100.0) * ((high-low) of EURange)))
            //
            // Specifying a deadbandValue outside of this range will be rejected and reported with the
            // StatusCode Bad_DeadbandFilterInvalid (see Table 27).
            // If the Value of the MonitoredItem is an array, then the deadband calculation logic shall be applied to
            // each element of the array. If an element that requires a DataChange is found, then no further
            // deadband checking is necessary and the entire array shall be returned.
            //assert(false, "Not implemented yet");
            assert(_.isNumber(valueRange));
            return check_deadband(variant1,variant2,DeadbandType.Absolute,valueRange * deadbandValue /100);
    }
}
exports.check_deadband = check_deadband;

