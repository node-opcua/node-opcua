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
var UAStateMachine = require("lib/address_space/state_machine/finite_state_machine").UAStateMachine;
var NodeId = require("lib/datamodel/nodeid").NodeId;


var ConditionInfo = require("./condition").ConditionInfo;

/**
 * @class UAExclusiveLimitAlarm
 * @extends UALimitAlarm
 * @constructor
 */
function UAExclusiveLimitAlarm() {
    /**
     * @property limitState
     * @type  UAStateMachine
     */
}
util.inherits(UAExclusiveLimitAlarm, UALimitAlarm);

var validState = [ "HighHigh","High","Low","LowLow",null];


UAExclusiveLimitAlarm.prototype._signalNewCondition = function(stateName, isActive, value) {

    var alarm = this;

    assert(validState.indexOf(stateName)>=0,"must have a valid state : " + stateName);

    var oldState   = alarm.limitState.getCurrentState();
    var oldActive  = alarm.activeState.getValue();

    if (stateName) {
        alarm.limitState.setState(stateName);
    } else {
        assert(stateName == null);
        alarm.limitState.setState(stateName);
    }
    UALimitAlarm.prototype._signalNewCondition.call(this,stateName,isActive,value);
};

UAExclusiveLimitAlarm.prototype._setStateBasedOnInputValue = function(value) {

    assert(_.isFinite(value));

    var alarm = this;

    var isActive = false;

    var state = null;

    var oldState =alarm.limitState.getCurrentState();

    if (alarm.highHighLimit && alarm.getHighHighLimit() < value) {
        state = "HighHigh";
        isActive= true;
    } else if (alarm.highLimit && alarm.getHighLimit() < value) {
        state = "High";
        isActive= true;
    } else if (alarm.lowLowLimit && alarm.getLowLowLimit() > value) {
        state = "LowLow";
        isActive= true;
    } else if (alarm.lowLimit && alarm.getLowLimit() > value) {
        state = "Low";
        isActive= true;
    }

    if (state!=oldState) {
        alarm._signalNewCondition(state,isActive,value);
    }

};



exports.UAExclusiveLimitAlarm = UAExclusiveLimitAlarm;

/***
 *
 * @method (static)instantiate
 * @param type
 * @param options
 * @param data
 * @return {UAExclusiveLimitAlarm}
 */
UAExclusiveLimitAlarm.instantiate = function (addressSpace, type, options, data) {

    //xx assert(options.conditionOf,"must provide a conditionOf Node");
    var exclusiveAlarmType = addressSpace.findEventType(type);

    /* istanbul ignore next */
    if (!exclusiveAlarmType) {
        throw new Error(" cannot find Alarm Condition Type for " + type);
    }

    var exclusiveLimitAlarmType = addressSpace.findEventType("ExclusiveLimitAlarmType");
    /* istanbul ignore next */
    if (!exclusiveLimitAlarmType) {
        throw new Error("cannot find ExclusiveLimitAlarmType");
    }

    var alarm = UALimitAlarm.instantiate(addressSpace, type, options, data);
    Object.setPrototypeOf(alarm, UAExclusiveLimitAlarm.prototype);
    assert(alarm instanceof UAExclusiveLimitAlarm);
    assert(alarm instanceof UALimitAlarm);

    // ---------------- install LimitState StateMachine
    assert(alarm.limitState, "limitState is mandatory");
    UAStateMachine.promote(alarm.limitState);

    // start with a inactive state
    alarm.activeState.setValue(false);

    var currentValue = alarm.getInputNodeNode().readValue();
    alarm._onInputDataValueChange(currentValue);

    return alarm;
};
