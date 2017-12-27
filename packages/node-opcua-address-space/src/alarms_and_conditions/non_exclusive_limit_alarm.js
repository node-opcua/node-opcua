"use strict";
/**
 * @module opcua.address_space.AlarmsAndConditions
 */

var util = require("util");
var assert = require("node-opcua-assert");
var _ = require("underscore");

var StatusCodes = require("node-opcua-status-code").StatusCodes;
var DataType = require("node-opcua-variant").DataType;

var UALimitAlarm = require("./limit_alarm").UALimitAlarm;
var DataValue =  require("node-opcua-data-value").DataValue;
var AddressSpace = require("../address_space").AddressSpace;

var ConditionInfo = require("./condition").ConditionInfo;

/***
 * @class  UANonExclusiveLimitAlarm
 * @extends UALimitAlarm
 * @constructor
 */
function UANonExclusiveLimitAlarm() {

    /**
     * @property lowLowState
     * @type UATwoStateVariable
     */
    /**
     * @property lowState
     * @type UATwoStateVariable
     */
    /**
     * @property highState
     * @type UATwoStateVariable
     */
    /**
     * @property highHighState
     * @type UATwoStateVariable
     */
}
util.inherits(UANonExclusiveLimitAlarm, UALimitAlarm);

UANonExclusiveLimitAlarm.prototype._calculateConditionInfo = function (states, isActive, value, oldConditionInfo) {

    if (!isActive) {
        return new ConditionInfo({
            severity: 0,
            message: "Back to normal",
            quality: StatusCodes.Good,
            retain: true
        });

    } else {
        // build-up state string
        var state_str = Object.keys(states).map(function(s) {
            return  states[s] === true ? s : null;
        }).filter(function(a) { return !!a;}).join(";"); //

        state_str = JSON.stringify(states);

        return new ConditionInfo({
            severity: 150,
            message: "Condition value is " + value + " and state is " + state_str,
            quality: StatusCodes.Good,
            retain: true
        });

    }

};

UANonExclusiveLimitAlarm.prototype._signalNewCondition = function (states, isActive, value) {

    var alarm = this;

    if (!states) {
        return;
    }
    function _install(name) {
        if (states[name] !== "unset") {
            alarm[name + "State"].setValue(states[name]);
        }
    }

    _install("highHigh");
    _install("high");
    _install("low");
    _install("lowLow");

    UALimitAlarm.prototype._signalNewCondition.call(this, states, isActive, value);
};

UANonExclusiveLimitAlarm.prototype._setStateBasedOnInputValue = function (value) {

    assert(_.isFinite(value),"expecting a valid value here");

    var alarm = this;

    var isActive = false;

    var states = {
        highHigh: alarm.highHighState ? alarm.highHighState.getValue() : "unset",
        high: alarm.highState ? alarm.highState.getValue() : "unset",
        low: alarm.lowState ? alarm.lowState.getValue() : "unset",
        lowLow: alarm.lowLowState ? alarm.lowLowState.getValue() : "unset"
    };

    var count = 0;

    function ___p(stateName, func_value) {
        if (states[stateName] !== "unset") {
            var value = func_value();
            isActive = isActive || value;
            if (states[stateName] !== value) {
                states[stateName] = value;
                count += 1;
            }
        }
    }

    ___p("highHigh", function () {
        return alarm.getHighHighLimit() < value;
    });
    ___p("high", function () {
        return alarm.getHighLimit() < value;
    });
    ___p("low", function () {
        return alarm.getLowLimit() > value;
    });
    ___p("lowLow", function () {
        return alarm.getLowLowLimit() > value;
    });

    if (count > 0) {
        alarm._signalNewCondition(states, isActive, value)
    }
};

exports.UANonExclusiveLimitAlarm = UANonExclusiveLimitAlarm;

/**
 * @method (static)instantiate
 * @param addressSpace
 * @param type
 * @param options
 * @param data
 * @return {UANonExclusiveLimitAlarm}
 */
UANonExclusiveLimitAlarm.instantiate = function (addressSpace, type, options, data) {

    options.optionals = options.optionals || [];

    if (options.hasOwnProperty("lowLowLimit")) {
        options.optionals.push("LowLowLimit");
        options.optionals.push("LowLowState");
    }
    if (options.hasOwnProperty("lowLimit")) {
        options.optionals.push("LowLimit");
        options.optionals.push("LowState");
    }
    if (options.hasOwnProperty("highLimit")) {
        options.optionals.push("HighLimit");
        options.optionals.push("HighState");
    }
    if (options.hasOwnProperty("highHighLimit")) {
        options.optionals.push("HighHighLimit");
        options.optionals.push("HighHighState");
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
    assert(alarm instanceof UALimitAlarm);
    assert(alarm instanceof UANonExclusiveLimitAlarm);

    // ---------------- install States
    if (alarm.lowLowState) {
        AddressSpace._install_TwoStateVariable_machinery(alarm.lowLowState, {
            trueState: "LowLow active",
            falseState: "LowLow inactive"
        });
        alarm.lowLowState.setValue(false);
        assert(alarm.hasOwnProperty("lowLowLimit"));
    }
    if (alarm.lowState) {
        AddressSpace._install_TwoStateVariable_machinery(alarm.lowState, {
            trueState: "Low active",
            falseState: "Low inactive"
        });
        alarm.lowState.setValue(false);
        assert(alarm.hasOwnProperty("lowLimit"));
    }
    if (alarm.highState) {
        AddressSpace._install_TwoStateVariable_machinery(alarm.highState, {
            trueState: "High active",
            falseState: "High inactive"
        });
        alarm.highState.setValue(false);
        assert(alarm.hasOwnProperty("highLimit"));
    }
    if (alarm.highHighState) {
        AddressSpace._install_TwoStateVariable_machinery(alarm.highHighState, {
            trueState: "HighHigh active",
            falseState: "HighHigh inactive"
        });
        alarm.highHighState.setValue(false);
        assert(alarm.hasOwnProperty("highHighLimit"));
    }

    alarm.activeState.setValue(false);

    alarm.updateState();

    return alarm;
};
