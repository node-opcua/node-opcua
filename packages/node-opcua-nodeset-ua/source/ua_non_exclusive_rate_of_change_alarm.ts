// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UANonExclusiveLimitAlarm, UANonExclusiveLimitAlarm_Base } from "./ua_non_exclusive_limit_alarm"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |NonExclusiveRateOfChangeAlarmType ns=0;i=10214    |
 * |isAbstract      |false                                             |
 */
export interface UANonExclusiveRateOfChangeAlarm_Base extends UANonExclusiveLimitAlarm_Base {
    engineeringUnits?: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
}
export interface UANonExclusiveRateOfChangeAlarm extends UANonExclusiveLimitAlarm, UANonExclusiveRateOfChangeAlarm_Base {
}