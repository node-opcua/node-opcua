/**
 * @module opcua.address_space.AlarmsAndConditions
 */
const util = require("util");
const UAOffNormalAlarm = require("./off_normal_alarm").UAOffNormalAlarm;
/**
 * @class UATripAlarm
 *
 * The TripAlarmType is a specialization of the OffNormalAlarmType intended to represent an equipment trip Condition.
 * The Alarm becomes active when the monitored piece of equipment experiences some abnormal fault such as a motor
 * shutting down due to an overload Condition. This Type is mainly used for categorization.
 *
 *  @extends UAOffNormalAlarm
 * @constructor
 */
function UATripAlarm() {

}
util.inherits(UATripAlarm, UAOffNormalAlarm);


