"use strict";
require("requirish")._(module);
var util = require("util");
var assert = require("assert");
var _ = require("underscore");


var UAExclusiveLimitAlarm = require("./exclusive_limit_alarm").UAExclusiveLimitAlarm;

/**
 *
 * @constructor
 */
function UAExclusiveLevelAlarm() {
}
util.inherits(UAExclusiveLevelAlarm, UAExclusiveLimitAlarm);
exports.UAExclusiveLevelAlarm =UAExclusiveLevelAlarm;

UAExclusiveLevelAlarm.instantiate = function(addressSpace,type,option,data) {
    return UAExclusiveLimitAlarm.instantiate(addressSpace, type, option, data);
};
