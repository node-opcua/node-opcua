/**
 * @module opcua.address_space.AlarmsAndConditions
 */
require("requirish")._(module);
const util = require("util");
const assert = require("assert");
const _ = require("underscore");


const UAExclusiveLimitAlarm = require("./exclusive_limit_alarm").UAExclusiveLimitAlarm;

/**
 * @class UAExclusiveLevelAlarm
 * @extends UAExclusiveLimitAlarm
 * @constructor
 */
function UAExclusiveLevelAlarm() {
}
util.inherits(UAExclusiveLevelAlarm, UAExclusiveLimitAlarm);
exports.UAExclusiveLevelAlarm =UAExclusiveLevelAlarm;

UAExclusiveLevelAlarm.instantiate = (addressSpace, type, option, data) => UAExclusiveLimitAlarm.instantiate(addressSpace, type, option, data);
