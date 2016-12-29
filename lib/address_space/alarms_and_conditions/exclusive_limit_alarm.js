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

var validState = [ "HighHigh","High","Low","LowLow",null];



/***
 * @method  _calculateConditionInfo
 * @param stateName  the new calculated state of the alarm
 * @param value         the new value of the limit alarm
 * @param oldCondition  {ConditionInfo} given for information purpose
 * @param oldCondition.severity
 * @param oldCondition.quality
 * @param oldCondition.message
 * @param oldCondition.retain
 * @return {ConditionInfo} the new condition info
 *
 * this method need to be overridden by the instantiate to allow custom message and severity
 * to be set based on specific context of the alarm.
 *
 * @example
 *
 *
 *    var myAlarm = addressSpace.instantiateExclusiveLimitAlarm({...});
 *    myAlarm._calculateConditionInfo = function(stateName,value,oldCondition) {
 *       var percent = Math.ceil(value * 100);
 *       return new ConditionInfo({
 *            message: "Tank is almost " + percent + "% full",
 *            severity: 100,
  *           quality: StatusCodes.Good
  *      });
 *    };
 *
 */
UAExclusiveLimitAlarm.prototype._calculateConditionInfo = function(stateName,value,oldCondition) {

    if (!stateName) {
        return new ConditionInfo({
            severity: 0,
            message:  "Back to normal",
            quality:  StatusCodes.Good,
            retain:   true
        });
    }
    // xx {message: "Tank is almost 70% full", severity: 100, quality: StatusCodes.Good});
    return new ConditionInfo({
        severity: 150,
        message:  "Condition value is " + value + " and state is " + stateName,
        quality:  StatusCodes.Good,
        retain:   true
    });
};

var ConditionInfo = require("./condition").ConditionInfo;

UAExclusiveLimitAlarm.prototype._signalNewCondition = function(stateName,value) {
    var alarm = this;
    assert( validState.indexOf(stateName)>=0,"must have a valid state : " + stateName);

    var oldState   = alarm.limitState.getCurrentState();
    var oldActive  = alarm.activeState.getValue();
    var oldSeverity= alarm.currentBranch().getSeverity();
    var oldQuality = alarm.currentBranch().getQuality();
    var oldMessage = alarm.currentBranch().getMessage();

    var oldConditionInfo = new ConditionInfo({
        severity: oldSeverity,
        quality: oldQuality,
        message: oldMessage
    });
    var newConditionInfo = alarm._calculateConditionInfo(stateName,value,oldConditionInfo);


    if (stateName) {

        alarm.limitState.setState(stateName);
        alarm.currentBranch().setActiveState(true);
        alarm.currentBranch().setAckedState(false);
        //
        var conditionHasChanged =
            newConditionInfo.severity != oldConditionInfo.severity ||
            newConditionInfo.quality != oldConditionInfo.quality ||  !oldActive;

        if (conditionHasChanged) {
            alarm.raiseNewCondition(newConditionInfo);
        }

    } else {
        assert(stateName == null);
        if (alarm.currentBranch().getAckedState()== false) {
            // prior state need acknowledgement
            // note : TODO : timestamp of branch and new state of current branch must be identical

            // we need to create a new branch so the previous state
            // could be acknowledge
            var newBranch = alarm.createBranch();
            assert(newBranch.getBranchId() != NodeId.NullNodeId);
            // also raised a new Event for the new branch as branchId has changed
            alarm.raiseNewBranchState(newBranch);
        }

        alarm.limitState.setState(stateName);

        alarm.currentBranch().setActiveState(false);
        alarm.currentBranch().setAckedState(true);

        var conditionHasChanged =
            newConditionInfo.severity != oldConditionInfo.severity ||
            newConditionInfo.quality != oldConditionInfo.quality || oldActive;

        if (conditionHasChanged) {
            alarm.raiseNewCondition(newConditionInfo);
        }
    }
};

UAExclusiveLimitAlarm.prototype._setStateBasedOnInputValue = function(value) {

    var alarm = this;

    assert(_.isFinite(value));

    if (alarm.highHighLimit && alarm.getHighHighLimit() < value) {
        alarm._signalNewCondition("HighHigh",value);
       return;
    }
    if (alarm.highLimit && alarm.getHighLimit() < value) {
        alarm._signalNewCondition("High",value);
        return;
    }
    if (alarm.lowLowLimit && alarm.getLowLowLimit() > value) {
        alarm._signalNewCondition("LowLow",value);
        return;
    }
    if (alarm.lowLimit && alarm.getLowLimit() > value) {
        alarm._signalNewCondition("Low",value);
        return;
    }
    alarm._signalNewCondition(null);
};

UAExclusiveLimitAlarm.prototype._onInputDataValueChange = function (dataValue) {

    assert(dataValue instanceof DataValue);
    var alarm = this;
    if (dataValue.statusCode !== StatusCodes.Good) {
        // what shall we do ?
        alarm._signalNewCondition(null);
        return;
    }
    if (dataValue.value.dataType === DataType.Null) {
        // what shall we do ?
        alarm._signalNewCondition(null);
        return;
    }
    var value = dataValue.value.value;
    alarm._setStateBasedOnInputValue(value);
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

    //xx assert(options.conditionOf,"must provide a conditionOf Node");
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
    UAStateMachine.promote(alarm.limitState);

    alarm.activeState.setValue(false);

    var currentValue = alarm.getInputNodeNode().readValue();
    alarm._onInputDataValueChange(currentValue);
    return alarm;
};
