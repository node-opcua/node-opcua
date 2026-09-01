/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import type { UAExclusiveRateOfChangeAlarm_Base } from "node-opcua-nodeset-ua";
import type { UAExclusiveLimitAlarmEx } from "../../api/interfaces/alarms_and_conditions/ua_exclusive_limit_alarm_ex.js";
import { UAExclusiveLimitAlarmImpl } from "./ua_exclusive_limit_alarm_impl.js";

export interface UAExclusiveRateOfChangeAlarmEx
    extends Omit<
            UAExclusiveRateOfChangeAlarm_Base,
            | "ackedState"
            | "activeState"
            | "confirmedState"
            | "enabledState"
            | "latchedState"
            | "limitState"
            | "outOfServiceState"
            | "shelvingState"
            | "silenceState"
            | "suppressedState"
        >,
        UAExclusiveLimitAlarmEx {}
export class UAExclusiveRateOfChangeAlarmImpl extends UAExclusiveLimitAlarmImpl implements UAExclusiveRateOfChangeAlarmEx {
    /** empty interface */
}
