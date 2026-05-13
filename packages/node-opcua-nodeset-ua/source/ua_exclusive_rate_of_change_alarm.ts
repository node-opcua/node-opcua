import type { UAProperty } from "node-opcua-address-space-base";
import type { EUInformation } from "node-opcua-data-access";
import type { DataType } from "node-opcua-variant";

import type { UAExclusiveLimitAlarm, UAExclusiveLimitAlarm_Base } from "./ua_exclusive_limit_alarm";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ExclusiveRateOfChangeAlarmType i=9623                       |
 * |isAbstract      |false                                                       |
 */
export interface UAExclusiveRateOfChangeAlarm_Base extends UAExclusiveLimitAlarm_Base {
    engineeringUnits?: UAProperty<EUInformation, DataType.ExtensionObject>;
}
export interface UAExclusiveRateOfChangeAlarm extends UAExclusiveLimitAlarm, UAExclusiveRateOfChangeAlarm_Base {}