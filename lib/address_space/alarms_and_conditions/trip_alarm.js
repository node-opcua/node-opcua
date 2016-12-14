/**
 * @module opcua.address_space.AlarmsAndConditions
 */
/**
 * @class UATripAlarm
 * @extends UAOffNormalAlarm
 * @constructor
 * The TripAlarmType is a specialization of the OffNormalAlarmType intended to represent an equipment trip Condition.
 * The Alarm becomes active when the monitored piece of equipment experiences some abnormal fault such as a motor
 * shutting down due to an overload Condition. This Type is mainly used for categorization.
 */
function UATripAlarm() {

}
util.inherits(UATripAlarm, UAOffNormalAlarm);


