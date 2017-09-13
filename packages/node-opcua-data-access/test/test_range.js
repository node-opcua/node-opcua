"use strict";
var _ = require("underscore");
var should = require("should");
var assert = require("node-opcua-assert");

var Range = require("..").Range;
// DeadbandType = PercentDeadband
// For this type of deadband the  deadbandValue  is defined  as the percentage of the  EURange.   That is,
// it applies only to  AnalogItems   with  an  EURange  Property  that define s  the   typical value   range for
// the item. This range  shall  be multiplied with the  deadbandValue  and then compared to the actual value
// change to determine the need for a data change notification .  The following pseudo code shows how
// the deadband is calculated :
//    DataChange if (absolute value of (last cached value - current value) > (deadbandValue/100.0) * ((high low) of EURange)))
// The range of the  deadbandValue  is from 0.0 to 100.0 Percent.   Specifying a  deadbandValue  outside
// of this range will be rejected and reported with the  StatusCode  Bad_DeadbandFilterInvalid (see
// Table 27) .
// If the Value of the  MonitoredItem  is an array, then the deadband calculation logic shall be applied to
// each element of the array. If an element that requires a DataChange is found, then no further
// deadband checking is necessary and the  entire array shall be returned

function get_deadband_percent(euRange, deadBandValue) {
    assert(euRange instanceof Range);
    assert(_.isFinite(euRange.low));
    assert(_.isFinite(euRange.high));
    //xx console.log(euRange.toString());
    return (euRange.high - euRange.low) * deadBandValue / 100.0;
}

function check_change_deadband(euRange, deadBandValue, delta) {
    assert((deadBandValue >= 0 && deadBandValue <= 100)); // return { statusCode: StatusCodes.BadDeadbandFilterInvalid };
    return Math.abs(delta) > get_deadband_percent(euRange, deadBandValue);
}
describe("PercentDeadband with EURange", function () {

    it("detect a change when range is [0,100], deadband 10% ", function () {
        var range = new Range({low: 0, high: 100});
        get_deadband_percent(range, 10).should.eql(10);

        check_change_deadband(range, 10 /*%*/, 5).should.eql(false);
        check_change_deadband(range, 10 /*%*/, 11).should.eql(true);
    });
    it("detect a change when range is [-100,100], deadband 10% ", function () {
        var range = new Range({low: -100, high: 100});
        check_change_deadband(range, 10 /*%*/, 5).should.eql(false);
        check_change_deadband(range, 10 /*%*/, 11).should.eql(false);
        check_change_deadband(range, 10 /*%*/, 21).should.eql(true);
    });
    it("detect a change when range is [-100,100], deadband 50% ", function () {
        var range = new Range({low: -100, high: 100});
        check_change_deadband(range, 50 /*%*/, 5).should.eql(false);
        check_change_deadband(range, 50 /*%*/, 11).should.eql(false);
        check_change_deadband(range, 50 /*%*/, 51).should.eql(false);
        check_change_deadband(range, 50 /*%*/, 101).should.eql(true);
    });
});
