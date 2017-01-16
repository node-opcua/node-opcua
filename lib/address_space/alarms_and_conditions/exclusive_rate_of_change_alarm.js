/**
 * @module opcua.address_space.AlarmsAndConditions
 */
require("requirish")._(module);
const util = require("util");
const assert = require("assert");
const _ = require("underscore");


const UAExclusiveLimitAlarm = require("./exclusive_limit_alarm").UAExclusiveLimitAlarm;

/**
 * @class UAExclusiveRateOfChangeAlarm
 * @extends UAExclusiveLimitAlarm
 * @constructor
 */
function UAExclusiveRateOfChangeAlarm() {
}
util.inherits(UAExclusiveRateOfChangeAlarm, UAExclusiveLimitAlarm);
