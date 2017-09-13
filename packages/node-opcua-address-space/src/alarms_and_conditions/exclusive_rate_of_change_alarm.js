"use strict";
/**
 * @module opcua.address_space.AlarmsAndConditions
 */

var util = require("util");



var UAExclusiveLimitAlarm = require("./exclusive_limit_alarm").UAExclusiveLimitAlarm;

/**
 * @class UAExclusiveRateOfChangeAlarm
 * @extends UAExclusiveLimitAlarm
 * @constructor
 */
function UAExclusiveRateOfChangeAlarm() {
}
util.inherits(UAExclusiveRateOfChangeAlarm, UAExclusiveLimitAlarm);
