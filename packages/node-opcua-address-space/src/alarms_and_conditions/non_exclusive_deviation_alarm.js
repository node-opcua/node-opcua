"use strict";
/**
 * @module opcua.address_space.AlarmsAndConditions
 */

const util = require("util");
const assert = require("node-opcua-assert").assert;
const _ = require("underscore");

const DeviationAlarmHelper  = require("./deviation_alarm_helper").DeviationAlarmHelper;

const UANonExclusiveLimitAlarm = require("./non_exclusive_limit_alarm").UANonExclusiveLimitAlarm;
const UALimitAlarm = require("./limit_alarm").UALimitAlarm;
const AddressSpace =require("../address_space").AddressSpace;
const Namespace = require("../namespace").Namespace;

/**
 * @class UANonExclusiveDeviationAlarm
 * @extends UANonExclusiveLimitAlarm
 * @constructor
 */
function UANonExclusiveDeviationAlarm() {
}
util.inherits(UANonExclusiveDeviationAlarm, UANonExclusiveLimitAlarm);

/**
 *  @method getSetpointNodeNode
 *  @return {UAVariable}
 */
UANonExclusiveDeviationAlarm.prototype.getSetpointNodeNode= DeviationAlarmHelper.getSetpointNodeNode;

/**
 *  @method getSetpointValue
 *  @return {Number}
 */
UANonExclusiveDeviationAlarm.prototype.getSetpointValue = DeviationAlarmHelper.getSetpointValue;


UANonExclusiveDeviationAlarm.prototype._onSetpointDataValueChange = DeviationAlarmHelper._onSetpointDataValueChange;
UANonExclusiveDeviationAlarm.prototype._install_setpoint= DeviationAlarmHelper._install_setpoint;

UANonExclusiveDeviationAlarm.prototype._setStateBasedOnInputValue = function(value) {
    const setpointValue = this.getSetpointValue();
    assert(_.isFinite(setpointValue),"expecting a valid setpoint value");
    // call base class implementation
    UANonExclusiveLimitAlarm.prototype._setStateBasedOnInputValue.call(this,value-setpointValue);
};

exports.UANonExclusiveDeviationAlarm = UANonExclusiveDeviationAlarm;

/**
 * @method (static)UANonExclusiveDeviationAlarm.instantiate
 * @param namespace {Namespace}
 * @param type
 * @param options
 * @param data
 * @return {UANonExclusiveDeviationAlarm}
 */
UANonExclusiveDeviationAlarm.instantiate = function(namespace, type,options,data ){


    assert(namespace instanceof Namespace);
    const addressSpace = namespace.__addressSpace;
    assert(addressSpace instanceof AddressSpace);

    const nonExclusiveDeviationAlarmType = addressSpace.findEventType("NonExclusiveDeviationAlarmType");
    /* istanbul ignore next */
    if (!nonExclusiveDeviationAlarmType) {
        throw new Error("cannot find ExclusiveDeviationAlarmType");
    }
    assert(type === nonExclusiveDeviationAlarmType.browseName.toString());

    const alarm = UANonExclusiveLimitAlarm.instantiate(namespace, type, options, data);
    Object.setPrototypeOf(alarm,UANonExclusiveDeviationAlarm.prototype);

    assert(alarm instanceof UANonExclusiveDeviationAlarm);
    assert(alarm instanceof UANonExclusiveLimitAlarm);
    assert(alarm instanceof UALimitAlarm);

    alarm._install_setpoint(alarm,options);

    return alarm;
};