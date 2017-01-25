/**
 * @module opcua.address_space.AlarmsAndConditions
 */
import util from "util";
import assert from "assert";
import _ from "underscore";
import deviationAlarmHelper from "./deviationAlarmHelper";
import UANonExclusiveLimitAlarm from "./UANonExclusiveLimitAlarm";
import UALimitAlarm from "./UALimitAlarm";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { DataType } from "lib/datamodel/variant";

/**
 * @class UANonExclusiveDeviationAlarm
 * @extends UANonExclusiveLimitAlarm
 * @constructor
 */
class UANonExclusiveDeviationAlarm extends UANonExclusiveLimitAlarm {
  _setStateBasedOnInputValue(value) {
    const setpointValue = this.getSetpointValue();
    assert(_.isFinite(setpointValue));
     // call base class implementation
    super._setStateBasedOnInputValue(value - setpointValue);
  }
}

/**
 *  @method getSetpointNodeNode
 *  @return {UAVariable}
 */
UANonExclusiveDeviationAlarm.prototype.getSetpointNodeNode = deviationAlarmHelper.getSetpointNodeNode;

/**
 *  @method getSetpointValue
 *  @return {Number}
 */
UANonExclusiveDeviationAlarm.prototype.getSetpointValue = deviationAlarmHelper.getSetpointValue;


UANonExclusiveDeviationAlarm.prototype._onSetpointDataValueChange = deviationAlarmHelper._onSetpointDataValueChange;
UANonExclusiveDeviationAlarm.prototype._install_setpoint = deviationAlarmHelper._install_setpoint;


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

export default UANonExclusiveDeviationAlarm;
