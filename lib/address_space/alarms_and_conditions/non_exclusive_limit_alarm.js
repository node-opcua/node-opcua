"use strict";
/**
 * @module opcua.address_space.AlarmsAndConditions
 */
require("requirish")._(module);
var util = require("util");
var assert = require("assert");
var _ = require("underscore");

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var DataType = require("lib/datamodel/variant").DataType;

var UALimitAlarm = require("./limit_alarm").UALimitAlarm;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;


/***
 * @class  UANonExclusiveLimitAlarm
 * @extends UALimitAlarm
 * @constructor
 */
function UANonExclusiveLimitAlarm() {

}
util.inherits(UANonExclusiveLimitAlarm, UALimitAlarm);

UANonExclusiveLimitAlarm.prototype._set_state = function(value)
{
    assert(_.isFinite(value));

    var count = 0;
    var alarm = this;
    if (alarm.highHighLimit) {
        if (alarm.getHighHighLimit() < value) {
            alarm.highHighState.setValue(true);
            count += 1;
        } else {
            alarm.highHighState.setValue(false);
        }
    }
    if (alarm.highLimit) {

        if (alarm.getHighLimit() < value) {
            alarm.highState.setValue(true);
            count += 1;
        } else {
            alarm.highState.setValue(false);
        }
    }
    if (alarm.lowLowLimit) {
        if (alarm.getLowLowLimit() > value) {
            alarm.lowLowState.setValue(true);
            count += 1;
        } else {
            alarm.lowLowState.setValue(false);
        }
    }
    if (alarm.lowLimit) {
        if (alarm.getLowLimit() > value) {
            alarm.lowState.setValue(true);
            count += 1;
        } else {
            alarm.lowState.setValue(false);
        }
    }
    alarm.activeState.setValue(count !== 0);
};

UANonExclusiveLimitAlarm.prototype._onInputDataValueChange = function (dataValue) {

    if (dataValue.statusCode !== StatusCodes.Good) {
        // what shall we do ?
        return;
    }
    if (dataValue.value.dataType === DataType.Null) {
        // what shall we do ?
        return;
    }
    assert(_.isFinite(dataValue.value.value));
    var value = dataValue.value.value;
    this._set_state(value);

};
exports.UANonExclusiveLimitAlarm = UANonExclusiveLimitAlarm;


UANonExclusiveLimitAlarm.instantiate = function (addressSpace, type, options, data) {

    options.optionals = options.optionals || [];

    if (options.hasOwnProperty("lowLowLimit")) {
        options.optionals.push["LowLowState"];
    }
    if (options.hasOwnProperty("lowLimit")) {
        options.optionals.push["LowState"];
    }
    if (options.hasOwnProperty("highLimit")) {
        options.optionals.push["HighState"];
    }
    if (options.hasOwnProperty("highHighLimit")) {
        options.optionals.push["HighHighState"];
    }
    var nonExclusiveAlarmType = addressSpace.findEventType(type);

    /* istanbul ignore next */
    if (!nonExclusiveAlarmType) {
        throw new Error(" cannot find Alarm Condition Type for " + type);
    }

    var nonExclusiveLimitAlarmType = addressSpace.findEventType("NonExclusiveLimitAlarmType");
    /* istanbul ignore next */
    if (!nonExclusiveLimitAlarmType) {
        throw new Error("cannot find NonExclusiveLimitAlarmType");
    }
    //assert(type nonExclusiveLimitAlarmType.browseName.toString());

    var alarm = UALimitAlarm.instantiate(addressSpace, type, options, data);
    Object.setPrototypeOf(alarm, UANonExclusiveLimitAlarm.prototype);
    assert(alarm instanceof UANonExclusiveLimitAlarm);
    assert(alarm instanceof UALimitAlarm);

    // ---------------- install States
    if (alarm.lowLowState) {
        AddressSpace._install_TwoStateVariable_machinery(alarm.lowLowState, {
            trueState: "LowLow active",
            falseState: "LowLow inactive"
        });
        alarm.lowLowState.setValue(false);
    }
    if (alarm.lowState) {
        AddressSpace._install_TwoStateVariable_machinery(alarm.lowState, {
            trueState: "Low active",
            falseState: "Low inactive"
        });
        alarm.lowState.setValue(false);
    }
    if (alarm.highState) {
        AddressSpace._install_TwoStateVariable_machinery(alarm.highState, {
            trueState: "High active",
            falseState: "High inactive"
        });
        alarm.highState.setValue(false);
    }
    if (alarm.highHighState) {
        AddressSpace._install_TwoStateVariable_machinery(alarm.highHighState, {
            trueState: "HighHigh active",
            falseState: "HighHigh inactive"
        });
        alarm.highHighState.setValue(false);
    }

    alarm.activeState.setValue(false);

    var currentValue = alarm.getInputNodeNode().readValue();
    alarm._onInputDataValueChange(currentValue);


    return alarm;
};
