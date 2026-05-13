import type { LocalizedText } from "node-opcua-data-model";

import type { UAExclusiveLimitStateMachine } from "./ua_exclusive_limit_state_machine";
import type { UALimitAlarm, UALimitAlarm_Base } from "./ua_limit_alarm";
import type { UATwoStateVariable } from "./ua_two_state_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ExclusiveLimitAlarmType i=9341                              |
 * |isAbstract      |false                                                       |
 */
export interface UAExclusiveLimitAlarm_Base extends UALimitAlarm_Base {
    activeState: UATwoStateVariable<LocalizedText>;
    limitState: UAExclusiveLimitStateMachine;
}
export interface UAExclusiveLimitAlarm extends Omit<UALimitAlarm, "activeState">, UAExclusiveLimitAlarm_Base {}