"use strict";
/**
 * @module opcua.address_space.AlarmsAndConditions
 */

var util = require("util");


var UAExclusiveLimitAlarm = require("./exclusive_limit_alarm").UAExclusiveLimitAlarm;

/**
 * @class UAExclusiveLevelAlarm
 * @extends UAExclusiveLimitAlarm
 * @constructor
 */
function UAExclusiveLevelAlarm() {
}
util.inherits(UAExclusiveLevelAlarm, UAExclusiveLimitAlarm);
exports.UAExclusiveLevelAlarm =UAExclusiveLevelAlarm;

UAExclusiveLevelAlarm.instantiate = function(addressSpace,type,option,data) {
    return UAExclusiveLimitAlarm.instantiate(addressSpace, type, option, data);
};
