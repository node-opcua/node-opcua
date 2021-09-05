// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UALimitAlarm, UALimitAlarm_Base } from "./ua_limit_alarm"
import { UATwoStateVariable } from "./ua_two_state_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |NonExclusiveLimitAlarmType ns=0;i=9906            |
 * |isAbstract      |false                                             |
 */
export interface UANonExclusiveLimitAlarm_Base extends UALimitAlarm_Base {
    activeState: UATwoStateVariable<LocalizedText>;
    highHighState?: UATwoStateVariable<LocalizedText>;
    highState?: UATwoStateVariable<LocalizedText>;
    lowState?: UATwoStateVariable<LocalizedText>;
    lowLowState?: UATwoStateVariable<LocalizedText>;
}
export interface UANonExclusiveLimitAlarm extends Omit<UALimitAlarm, "activeState">, UANonExclusiveLimitAlarm_Base {
}