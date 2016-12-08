"use strict";
require("requirish")._(module);
var util = require("util");
var assert = require("assert");
var _ = require("underscore");

var DeviationAlarmHelper  = require("./deviation_alarm_helper").DeviationAlarmHelper;

var UANonExclusiveLimitAlarm = require("./non_exclusive_limit_alarm").UANonExclusiveLimitAlarm;
var UALimitAlarm = require("./limit_alarm").UALimitAlarm;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var DataType = require("lib/datamodel/variant").DataType;
/**
 *
 * @constructor
 */
function UANonExclusiveDeviationAlarm() {
}
util.inherits(UANonExclusiveDeviationAlarm, UANonExclusiveLimitAlarm);

UANonExclusiveDeviationAlarm.prototype.getSetpointNodeNode= DeviationAlarmHelper.getSetpointNodeNode;
UANonExclusiveDeviationAlarm.prototype.getSetpointValue = DeviationAlarmHelper.getSetpointValue;
UANonExclusiveDeviationAlarm.prototype._onSetpointDataValueChange = DeviationAlarmHelper._onSetpointDataValueChange;
UANonExclusiveDeviationAlarm.prototype._install_setpoint= DeviationAlarmHelper._install_setpoint;

UANonExclusiveDeviationAlarm.prototype._set_state = function(value) {
    var setpointValue = this.getSetpointValue();
    assert(_.isFinite(setpointValue));
    // call base class implementation
    UANonExclusiveLimitAlarm.prototype._set_state.call(this,value-setpointValue);
};

exports.UANonExclusiveDeviationAlarm = UANonExclusiveDeviationAlarm;

UANonExclusiveDeviationAlarm.instantiate = function(addressSpace, type,options,data ){

    var nonExclusiveDeviationAlarmType = addressSpace.findEventType("NonExclusiveDeviationAlarmType");
    /* istanbul ignore next */
    if (!nonExclusiveDeviationAlarmType) {
        throw new Error("cannot find ExclusiveDeviationAlarmType");
    }

    assert(type === nonExclusiveDeviationAlarmType.browseName.toString());

    var alarm = UANonExclusiveLimitAlarm.instantiate(addressSpace, type, options, data);
    Object.setPrototypeOf(alarm,UANonExclusiveDeviationAlarm.prototype);

    assert(alarm instanceof UANonExclusiveDeviationAlarm);
    assert(alarm instanceof UANonExclusiveLimitAlarm);
    assert(alarm instanceof UALimitAlarm);

    alarm._install_setpoint(alarm,options);

    return alarm;
};