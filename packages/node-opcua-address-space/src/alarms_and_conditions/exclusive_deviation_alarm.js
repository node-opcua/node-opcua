"use strict";
/**
 * @module opcua.address_space.AlarmsAndConditions
 */

const util = require("util");
const assert = require("node-opcua-assert").assert;
const _ = require("underscore");

const DeviationAlarmHelper  = require("./deviation_alarm_helper").DeviationAlarmHelper;

const UAExclusiveLimitAlarm = require("./exclusive_limit_alarm").UAExclusiveLimitAlarm;
const UALimitAlarm = require("./limit_alarm").UALimitAlarm;
const StatusCodes = require("node-opcua-status-code").StatusCodes;
const DataType = require("node-opcua-variant").DataType;
const AddressSpace =require("../address_space").AddressSpace;
const Namespace = require("../namespace").Namespace;


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
    const setpointValue = this.getSetpointValue();
    assert(_.isFinite(setpointValue));
    // call base class implementation
    UAExclusiveLimitAlarm.prototype._setStateBasedOnInputValue.call(this,value - setpointValue);
};

exports.UAExclusiveDeviationAlarm = UAExclusiveDeviationAlarm;

/**
 *
 * @method instantiate
 * @param namespace {Namespace}
 * @param type
 * @param options
 * @param data
 * @return {UAExclusiveLimitAlarm}
 */
UAExclusiveDeviationAlarm.instantiate = function(namespace, type,options,data ){

    assert(namespace instanceof Namespace);
    const addressSpace = namespace.addressSpace;
    assert(addressSpace instanceof AddressSpace);

    const exclusiveDeviationAlarmType = addressSpace.findEventType("ExclusiveDeviationAlarmType");
    /* istanbul ignore next */
    if (!exclusiveDeviationAlarmType) {
        throw new Error("cannot find ExclusiveDeviationAlarmType");
    }

    assert(type === exclusiveDeviationAlarmType.browseName.toString());

    const alarm = UAExclusiveLimitAlarm.instantiate(namespace, type, options, data);
    Object.setPrototypeOf(alarm,UAExclusiveDeviationAlarm.prototype);

    assert(alarm instanceof UAExclusiveDeviationAlarm);
    assert(alarm instanceof UAExclusiveLimitAlarm);
    assert(alarm instanceof UALimitAlarm);

    alarm._install_setpoint(alarm,options);

    return alarm;
};