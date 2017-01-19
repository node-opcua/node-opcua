/**
 * @module opcua.address_space.AlarmsAndConditions
 */
require("requirish")._(module);
import util from "util";
import assert from "assert";
import _ from "underscore";
import {UAExclusiveLimitAlarm} from "./exclusive_limit_alarm";

/**
 * @class UAExclusiveLevelAlarm
 * @extends UAExclusiveLimitAlarm
 * @constructor
 */
function UAExclusiveLevelAlarm() {
}
util.inherits(UAExclusiveLevelAlarm, UAExclusiveLimitAlarm);
export {UAExclusiveLevelAlarm};

UAExclusiveLevelAlarm.instantiate = (addressSpace, type, option, data) => UAExclusiveLimitAlarm.instantiate(addressSpace, type, option, data);
