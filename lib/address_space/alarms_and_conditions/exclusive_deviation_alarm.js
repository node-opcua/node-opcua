/**
 * @module opcua.address_space.AlarmsAndConditions
 */
require("requirish")._(module);
import util from "util";
import assert from "assert";
import _ from "underscore";
import {DeviationAlarmHelper} from "./deviation_alarm_helper";
import {UAExclusiveLimitAlarm} from "./exclusive_limit_alarm";
import {UALimitAlarm} from "./limit_alarm";
import {StatusCodes} from "lib/datamodel/opcua_status_code";
import {DataType} from "lib/datamodel/variant";
/**
 * @class UAExclusiveDeviationAlarm
 * @extends UAExclusiveLimitAlarm
 * @constructor
 */
function UAExclusiveDeviationAlarm() {
}
util.inherits(UAExclusiveDeviationAlarm, UAExclusiveLimitAlarm);

UAExclusiveDeviationAlarm.prototype.getSetpointNodeNode = DeviationAlarmHelper.getSetpointNodeNode;
UAExclusiveDeviationAlarm.prototype.getSetpointValue = DeviationAlarmHelper.getSetpointValue;
UAExclusiveDeviationAlarm.prototype._onSetpointDataValueChange = DeviationAlarmHelper._onSetpointDataValueChange;
UAExclusiveDeviationAlarm.prototype._install_setpoint = DeviationAlarmHelper._install_setpoint;

UAExclusiveDeviationAlarm.prototype._setStateBasedOnInputValue = function (value) {
  const setpointValue = this.getSetpointValue();
  assert(_.isFinite(setpointValue));
    // call base class implementation
  UAExclusiveLimitAlarm.prototype._setStateBasedOnInputValue.call(this,value - setpointValue);
};

export {UAExclusiveDeviationAlarm};

/**
 *
 * @param addressSpace
 * @param type
 * @param options
 * @param data
 * @returns {UAExclusiveLimitAlarm}
 */
UAExclusiveDeviationAlarm.instantiate = (addressSpace, type, options, data) => {
  const exclusiveDeviationAlarmType = addressSpace.findEventType("ExclusiveDeviationAlarmType");
    /* istanbul ignore next */
  if (!exclusiveDeviationAlarmType) {
    throw new Error("cannot find ExclusiveDeviationAlarmType");
  }

  assert(type === exclusiveDeviationAlarmType.browseName.toString());

  const alarm = UAExclusiveLimitAlarm.instantiate(addressSpace, type, options, data);
  Object.setPrototypeOf(alarm,UAExclusiveDeviationAlarm.prototype);

  assert(alarm instanceof UAExclusiveDeviationAlarm);
  assert(alarm instanceof UAExclusiveLimitAlarm);
  assert(alarm instanceof UALimitAlarm);

  alarm._install_setpoint(alarm,options);

  return alarm;
};
