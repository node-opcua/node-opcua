"use strict";
require("requirish")._(module);
var util = require("util");
var assert = require("assert");
var _ = require("underscore");


var UAExclusiveLimitAlarm = require("./exclusive_limit_alarm").UAExclusiveLimitAlarm;
var UALimitAlarm = require("./limit_alarm").UALimitAlarm;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

/**
 *
 * @constructor
 */
function UAExclusiveDeviationAlarm() {
}
util.inherits(UAExclusiveDeviationAlarm, UAExclusiveLimitAlarm);

UAExclusiveDeviationAlarm.prototype._set_state = function(value) {

    assert(this.hasOwnProperty("setpointNode"));
    var setpointDataValue=this.setpointNodeNode.readValue();
    if (setpointDataValue.statusCode !== StatusCodes.Good) {
        return;
    }
    var setpointValue = setpointDataValue.value.value;
    assert(_.isFinite(setpointValue));

    UAExclusiveLimitAlarm.prototype._set_state.call(this,value-setpointValue);
};

exports.UAExclusiveDeviationAlarm = UAExclusiveDeviationAlarm;

UAExclusiveDeviationAlarm.instantiate = function(addressSpace, type,options,data ){

    // must provide a set point property
    assert(options.hasOwnProperty("setpointNode"),"must provide a setpointNode");
    var setpointNodeNode = addressSpace._coerceNode(options.setpointNode);
    assert(setpointNodeNode, "Expecting a valid setpoint node");

    var exclusiveDeviationAlarmType = addressSpace.findEventType("ExclusiveDeviationAlarmType");
    /* istanbul ignore next */
    if (!exclusiveDeviationAlarmType) {
        throw new Error("cannot find ExclusiveDeviationAlarmType");
    }

    assert(type === exclusiveDeviationAlarmType.browseName.toString());


    var alarm = UAExclusiveLimitAlarm.instantiate(addressSpace,type,options,data);
    Object.setPrototypeOf(alarm,UAExclusiveDeviationAlarm.prototype);
    assert(alarm instanceof UAExclusiveDeviationAlarm);
    assert(alarm instanceof UAExclusiveLimitAlarm);
    assert(alarm instanceof UALimitAlarm);

    assert(alarm.setpointNode.browseName.toString() === "SetpointNode");
    alarm.setpointNodeNode = addressSpace._coerceNode(options.setpointNode);
    alarm.setpointNode.setValueFromSource({dataType:"NodeId",value: alarm.setpointNodeNode.nodeId});
    return alarm;
};