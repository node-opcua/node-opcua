import type { LocalizedText } from "node-opcua-data-model";

import type { UALimitAlarm, UALimitAlarm_Base } from "./ua_limit_alarm";
import type { UATwoStateVariable } from "./ua_two_state_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |NonExclusiveLimitAlarmType i=9906                           |
 * |isAbstract      |false                                                       |
 */
export interface UANonExclusiveLimitAlarm_Base extends UALimitAlarm_Base {
    activeState: UATwoStateVariable<LocalizedText>;
    highHighState?: UATwoStateVariable<LocalizedText>;
    highState?: UATwoStateVariable<LocalizedText>;
    lowState?: UATwoStateVariable<LocalizedText>;
    lowLowState?: UATwoStateVariable<LocalizedText>;
}
export interface UANonExclusiveLimitAlarm extends Omit<UALimitAlarm, "activeState">, UANonExclusiveLimitAlarm_Base {}