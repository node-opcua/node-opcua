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
var DataValue = require("lib/datamodel/datavalue").DataValue;
var UALimitAlarm = require("./limit_alarm").UALimitAlarm;

/**
 * @class UAExclusiveLimitAlarm
 * @extends UALimitAlarm
 * @constructor
 */
function UAExclusiveLimitAlarm() {
    /**
     * @property limitState {UAStateMachine}
     */
}
util.inherits(UAExclusiveLimitAlarm, UALimitAlarm);


UAExclusiveLimitAlarm.prototype._set_state = function(value) {

    var alarm = this;

    assert(_.isFinite(value));

    if (alarm.highHighLimit && alarm.getHighHighLimit() < value) {
        alarm.limitState.setState("HighHigh");
        alarm.activeState.setValue(true);
        return;
    }
    if (alarm.highLimit && alarm.getHighLimit() < value) {
        alarm.limitState.setState("High");
        alarm.activeState.setValue(true);
        return;
    }
    if (alarm.lowLowLimit && alarm.getLowLowLimit() > value) {
        alarm.limitState.setState("LowLow");
        alarm.activeState.setValue(true);
        return;
    }
    if (alarm.lowLimit && alarm.getLowLimit() > value) {
        alarm.limitState.setState("Low");
        alarm.activeState.setValue(true);
        return;
    }
    alarm.limitState.setState(null);
    alarm.activeState.setValue(false);

};

UAExclusiveLimitAlarm.prototype._onInputDataValueChange = function (dataValue) {

    assert(dataValue instanceof DataValue);
    var alarm = this;
    if (dataValue.statusCode !== StatusCodes.Good) {
        // what shall we do ?
        alarm.limitState.setState(null);
        alarm.activeState.setValue(false);
        return;
    }
    if (dataValue.value.dataType === DataType.Null) {
        // what shall we do ?
        alarm.limitState.setState(null);
        alarm.activeState.setValue(false);
        return;
    }
    var value = dataValue.value.value;
    alarm._set_state(value);
};

exports.UAExclusiveLimitAlarm = UAExclusiveLimitAlarm;

/***
 *
 * @param exclusiveLimitAlarmTypeId
 * @param options
 * @param data
 * @return {UAExclusiveLimitAlarm}
 */
UAExclusiveLimitAlarm.instantiate = function (addressSpace, exclusiveLimitAlarmTypeId, options, data) {

    var exclusiveAlarmType = addressSpace.findEventType(exclusiveLimitAlarmTypeId);

    /* istanbul ignore next */
    if (!exclusiveAlarmType) {
        throw new Error(" cannot find Alarm Condition Type for " + exclusiveLimitAlarmTypeId);
    }

    var exclusiveLimitAlarmType = addressSpace.findEventType("ExclusiveLimitAlarmType");
    /* istanbul ignore next */
    if (!exclusiveLimitAlarmType) {
        throw new Error("cannot find ExclusiveLimitAlarmType");
    }

    var alarm = UALimitAlarm.instantiate(addressSpace, exclusiveLimitAlarmTypeId, options, data);

    Object.setPrototypeOf(alarm, UAExclusiveLimitAlarm.prototype);

    // ---------------- install LimitState StateMachine
    assert(alarm.limitState, "limitState is mandatory");
    var UAStateMachine = require("lib/address_space/finite_state_machine").UAStateMachine;
    UAStateMachine.promote(alarm.limitState);

    var currentValue = alarm.getInputNodeNode().readValue();
    alarm._onInputDataValueChange(currentValue);
    return alarm;
};
