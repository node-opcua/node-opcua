/**
 * @module opcua.address_space.AlarmsAndConditions
 */
import util from "util";
import assert from "assert";
import _ from "underscore";
import { UAExclusiveLimitAlarm } from "./exclusive_limit_alarm";

/**
 * @class UAExclusiveLevelAlarm
 * @extends UAExclusiveLimitAlarm
 * @constructor
 */
class UAExclusiveLevelAlarm extends UAExclusiveLimitAlarm {}


UAExclusiveLevelAlarm.instantiate = (addressSpace, type, option, data) => UAExclusiveLimitAlarm.instantiate(addressSpace, type, option, data);

export { UAExclusiveLevelAlarm };
