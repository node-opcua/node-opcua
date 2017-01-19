/**
 * @module opcua.address_space.AlarmsAndConditions
 */
import util from "util";
import assert from "assert";
import _ from "underscore";
import {UAExclusiveLimitAlarm} from "./exclusive_limit_alarm";

/**
 * @class UAExclusiveRateOfChangeAlarm
 * @extends UAExclusiveLimitAlarm
 * @constructor
 */
class UAExclusiveRateOfChangeAlarm extends UAExclusiveLimitAlarm {}
