/**
 * @module opcua.address_space.AlarmsAndConditions
 */

import util from "util";
import assert from "assert";
import _ from "underscore";
import {StatusCodes} from "lib/datamodel/opcua_status_code";
import {DataType} from "lib/datamodel/variant";
import {AddressSpace} from "lib/address_space/address_space";
import {UAAlarmConditionBase} from "./alarm_condition";

/*=
 *      +----------------------+
 *      | UAAlarmConditionBase |
 *      +----------------------+
 *               ^
 *               |
 *      +--------+---------+
 *      | UADiscreteAlarm  |
 *      +------------------+
 *               ^
 *               |
 *      +--------+---------+
 *      | UAOffNormalAlarm |
 *      +------------------+
 *               ^
 *               |
 *      +--------+---------+
 *      |   UATripAlarm    |
 *      +------------------+
 *
 *
 *
 */

/**
 * @class UADiscreteAlarm
 * @extends UAAlarmConditionBase
 * @constructor
 * The DiscreteAlarmType is used to classify Types into Alarm Conditions where the input for the
 * Alarm may take on only a certain number of possible values (e.g. true/false,
 * running/stopped/terminating).
 */
class UADiscreteAlarm extends UAAlarmConditionBase {}

UADiscreteAlarm.instantiate = (addressSpace, discreteAlarmTypeId, options, data) => {
  assert(addressSpace instanceof AddressSpace);

  const discreteAlarmType = addressSpace.findEventType(discreteAlarmTypeId);
    /* istanbul ignore next */
  if (!discreteAlarmType) {
    throw new Error(` cannot find Condition Type for ${discreteAlarmType}`);
  }

  const discreteAlarmTypeBase = addressSpace.findObjectType("DiscreteAlarmType");
  assert(discreteAlarmTypeBase,"expecting DiscreteAlarmType - please check you nodeset xml file!");

    /* eventTypeNode should be subtypeOf("DiscreteAlarmType"); */
    /* istanbul ignore next */
  if (!discreteAlarmType.isSupertypeOf(discreteAlarmTypeBase)) {
    throw new Error("UADiscreteAlarm.instantiate : event found is not subType of DiscreteAlarmType");
  }

  const alarmNode = UAAlarmConditionBase.instantiate(addressSpace, discreteAlarmType, options, data);
  Object.setPrototypeOf(alarmNode, UADiscreteAlarm.prototype);

  return alarmNode;
};
export {UADiscreteAlarm};

