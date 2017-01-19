/**
 * @module opcua.address_space.AlarmsAndConditions
 */
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
class UAExclusiveDeviationAlarm extends UAExclusiveLimitAlarm {
  _setStateBasedOnInputValue(value) {
    const setpointValue = this.getSetpointValue();
    assert(_.isFinite(setpointValue));
      // call base class implementation
    super._setStateBasedOnInputValue(value - setpointValue);
  }
}

UAExclusiveDeviationAlarm.prototype.getSetpointNodeNode = DeviationAlarmHelper.getSetpointNodeNode;
UAExclusiveDeviationAlarm.prototype.getSetpointValue = DeviationAlarmHelper.getSetpointValue;
UAExclusiveDeviationAlarm.prototype._onSetpointDataValueChange = DeviationAlarmHelper._onSetpointDataValueChange;
UAExclusiveDeviationAlarm.prototype._install_setpoint = DeviationAlarmHelper._install_setpoint;


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

export {UAExclusiveDeviationAlarm};
