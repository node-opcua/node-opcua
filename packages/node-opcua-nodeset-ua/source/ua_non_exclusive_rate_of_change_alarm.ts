import type { UAProperty } from "node-opcua-address-space-base";
import type { EUInformation } from "node-opcua-data-access";
import type { DataType } from "node-opcua-variant";

import type { UANonExclusiveLimitAlarm, UANonExclusiveLimitAlarm_Base } from "./ua_non_exclusive_limit_alarm";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |NonExclusiveRateOfChangeAlarmType i=10214                   |
 * |isAbstract      |false                                                       |
 */
export interface UANonExclusiveRateOfChangeAlarm_Base extends UANonExclusiveLimitAlarm_Base {
    engineeringUnits?: UAProperty<EUInformation, DataType.ExtensionObject>;
}
export interface UANonExclusiveRateOfChangeAlarm extends UANonExclusiveLimitAlarm, UANonExclusiveRateOfChangeAlarm_Base {}