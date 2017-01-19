/**
 * @module opcua.address_space.AlarmsAndConditions
 */
require("requirish")._(module);
import util from "util";
import assert from "assert";
import _ from "underscore";
import {UAExclusiveLimitAlarm} from "./exclusive_limit_alarm";

/**
 * @class UAExclusiveRateOfChangeAlarm
 * @extends UAExclusiveLimitAlarm
 * @constructor
 */
function UAExclusiveRateOfChangeAlarm() {
}
util.inherits(UAExclusiveRateOfChangeAlarm, UAExclusiveLimitAlarm);
