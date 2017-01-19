/**
 * @module opcua.address_space.AlarmsAndConditions
 */
require("requirish")._(module);
import util from "util";
import assert from "assert";
import _ from "underscore";
import {DeviationAlarmHelper} from "./deviation_alarm_helper";
import {UANonExclusiveLimitAlarm} from "./non_exclusive_limit_alarm";
import {UALimitAlarm} from "./limit_alarm";
import {StatusCodes} from "lib/datamodel/opcua_status_code";
import {DataType} from "lib/datamodel/variant";
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
UANonExclusiveDeviationAlarm.prototype.getSetpointNodeNode = DeviationAlarmHelper.getSetpointNodeNode;

/**
 *  @method getSetpointValue
 *  @return {Number}
 */
UANonExclusiveDeviationAlarm.prototype.getSetpointValue = DeviationAlarmHelper.getSetpointValue;


UANonExclusiveDeviationAlarm.prototype._onSetpointDataValueChange = DeviationAlarmHelper._onSetpointDataValueChange;
UANonExclusiveDeviationAlarm.prototype._install_setpoint = DeviationAlarmHelper._install_setpoint;

UANonExclusiveDeviationAlarm.prototype._setStateBasedOnInputValue = function (value) {
  const setpointValue = this.getSetpointValue();
  assert(_.isFinite(setpointValue));
    // call base class implementation
  UANonExclusiveLimitAlarm.prototype._setStateBasedOnInputValue.call(this,value - setpointValue);
};

export {UANonExclusiveDeviationAlarm};

/**
 * @method (static)UANonExclusiveDeviationAlarm.instantiate
 * @param addressSpace {AddressSpace}
 * @param type
 * @param options
 * @param data
 * @return {UANonExclusiveDeviationAlarm}
 */
UANonExclusiveDeviationAlarm.instantiate = (addressSpace, type, options, data) => {
  const nonExclusiveDeviationAlarmType = addressSpace.findEventType("NonExclusiveDeviationAlarmType");
    /* istanbul ignore next */
  if (!nonExclusiveDeviationAlarmType) {
    throw new Error("cannot find ExclusiveDeviationAlarmType");
  }
  assert(type === nonExclusiveDeviationAlarmType.browseName.toString());

  const alarm = UANonExclusiveLimitAlarm.instantiate(addressSpace, type, options, data);
  Object.setPrototypeOf(alarm,UANonExclusiveDeviationAlarm.prototype);

  assert(alarm instanceof UANonExclusiveDeviationAlarm);
  assert(alarm instanceof UANonExclusiveLimitAlarm);
  assert(alarm instanceof UALimitAlarm);

  alarm._install_setpoint(alarm,options);

  return alarm;
};
