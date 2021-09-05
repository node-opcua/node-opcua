// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UAExclusiveLimitAlarm, UAExclusiveLimitAlarm_Base } from "./ua_exclusive_limit_alarm"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |ExclusiveRateOfChangeAlarmType ns=0;i=9623        |
 * |isAbstract      |false                                             |
 */
export interface UAExclusiveRateOfChangeAlarm_Base extends UAExclusiveLimitAlarm_Base {
    engineeringUnits?: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
}
export interface UAExclusiveRateOfChangeAlarm extends UAExclusiveLimitAlarm, UAExclusiveRateOfChangeAlarm_Base {
}