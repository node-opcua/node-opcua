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
function UAExclusiveRateOfChangeAlarm() {
}
util.inherits(UAExclusiveRateOfChangeAlarm, UAExclusiveLimitAlarm);
