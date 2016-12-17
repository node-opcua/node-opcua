"use strict";
/**
 * @module opcua.address_space.AlarmsAndConditions
 */
require("requirish")._(module);
var util = require("util");
var assert = require("assert");
var _ = require("underscore");

var DeviationAlarmHelper  = require("./deviation_alarm_helper").DeviationAlarmHelper;

var UAExclusiveLimitAlarm = require("./exclusive_limit_alarm").UAExclusiveLimitAlarm;
var UALimitAlarm = require("./limit_alarm").UALimitAlarm;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var DataType = require("lib/datamodel/variant").DataType;
/**
 * @class UAExclusiveDeviationAlarm
 * @extends UAExclusiveLimitAlarm
 * @constructor
 */
function UAExclusiveDeviationAlarm() {
}
util.inherits(UAExclusiveDeviationAlarm, UAExclusiveLimitAlarm);

UAExclusiveDeviationAlarm.prototype.getSetpointNodeNode= DeviationAlarmHelper.getSetpointNodeNode;
UAExclusiveDeviationAlarm.prototype.getSetpointValue = DeviationAlarmHelper.getSetpointValue;
UAExclusiveDeviationAlarm.prototype._onSetpointDataValueChange = DeviationAlarmHelper._onSetpointDataValueChange;
UAExclusiveDeviationAlarm.prototype._install_setpoint= DeviationAlarmHelper._install_setpoint;

UAExclusiveDeviationAlarm.prototype._setStateBasedOnInputValue = function(value) {
    var setpointValue = this.getSetpointValue();
    assert(_.isFinite(setpointValue));
    // call base class implementation
    UAExclusiveLimitAlarm.prototype._setStateBasedOnInputValue.call(this,value - setpointValue);
};

exports.UAExclusiveDeviationAlarm = UAExclusiveDeviationAlarm;

/**
 *
 * @param addressSpace
 * @param type
 * @param options
 * @param data
 * @returns {UAExclusiveLimitAlarm}
 */
UAExclusiveDeviationAlarm.instantiate = function(addressSpace, type,options,data ){

    var exclusiveDeviationAlarmType = addressSpace.findEventType("ExclusiveDeviationAlarmType");
    /* istanbul ignore next */
    if (!exclusiveDeviationAlarmType) {
        throw new Error("cannot find ExclusiveDeviationAlarmType");
    }

    assert(type === exclusiveDeviationAlarmType.browseName.toString());

    var alarm = UAExclusiveLimitAlarm.instantiate(addressSpace, type, options, data);
    Object.setPrototypeOf(alarm,UAExclusiveDeviationAlarm.prototype);

    assert(alarm instanceof UAExclusiveDeviationAlarm);
    assert(alarm instanceof UAExclusiveLimitAlarm);
    assert(alarm instanceof UALimitAlarm);

    alarm._install_setpoint(alarm,options);

    return alarm;
};