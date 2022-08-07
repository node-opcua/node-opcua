import { UADiscreteAlarm_Base } from "node-opcua-nodeset-ua";
import { UAAlarmConditionEx, UAAlarmConditionHelper } from "./ua_alarm_condition_ex";

export interface UADiscreteAlarmHelper extends UAAlarmConditionHelper {
    on(eventName: string, eventHandle: any): this;
}
export interface UADiscreteAlarmEx
    extends UAAlarmConditionEx,
        Omit<
            UADiscreteAlarm_Base,
            | "suppressedState"
            | "silenceState"
            | "shelvingState"
            | "outOfServiceState"
            | "latchedState"
            | "confirmedState"
            | "ackedState"
            | "comfirmedState"
            | "activeState"
            | "enabledState"
        >,
        UADiscreteAlarmHelper {}
/*=
 *      +----------------------+
 *      | UAAlarmCondition     |
 *      +----------------------+
 *               ^
 *               |
 *      +--------+---------+
 *      | UADiscreteAlarm  |
 *      +------------------+
 *               ^
 *               |
 *      +--------+---------+
 *      | UAOffNormalAlarm |
 *      +------------------+
 *               ^
 *               |
 *      +--------+---------+
 *      |   UATripAlarm    |
 *      +------------------+
 *
 *
 *
 */
