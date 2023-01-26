/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { UAExclusiveRateOfChangeAlarm_Base } from "node-opcua-nodeset-ua";
import { UAExclusiveLimitAlarmEx } from "../../source/interfaces/alarms_and_conditions/ua_exclusive_limit_alarm_ex";
import { UAExclusiveLimitAlarmImpl } from "./ua_exclusive_limit_alarm_impl";

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
        UAExclusiveLimitAlarmEx {
    on(eventName: string, eventHandler: any): this;
}
export class UAExclusiveRateOfChangeAlarmImpl extends UAExclusiveLimitAlarmImpl implements UAExclusiveRateOfChangeAlarmEx {}
