import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt16 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAAlarmCondition, UAAlarmCondition_Base } from "./ua_alarm_condition";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |LimitAlarmType i=2955                                       |
 * |isAbstract      |false                                                       |
 */
export interface UALimitAlarm_Base extends UAAlarmCondition_Base {
    highHighLimit?: UAProperty<number, DataType.Double>;
    highLimit?: UAProperty<number, DataType.Double>;
    lowLimit?: UAProperty<number, DataType.Double>;
    lowLowLimit?: UAProperty<number, DataType.Double>;
    baseHighHighLimit?: UAProperty<number, DataType.Double>;
    baseHighLimit?: UAProperty<number, DataType.Double>;
    baseLowLimit?: UAProperty<number, DataType.Double>;
    baseLowLowLimit?: UAProperty<number, DataType.Double>;
    severityHighHigh?: UAProperty<UInt16, DataType.UInt16>;
    severityHigh?: UAProperty<UInt16, DataType.UInt16>;
    severityLow?: UAProperty<UInt16, DataType.UInt16>;
    severityLowLow?: UAProperty<UInt16, DataType.UInt16>;
    highHighDeadband?: UAProperty<number, DataType.Double>;
    highDeadband?: UAProperty<number, DataType.Double>;
    lowDeadband?: UAProperty<number, DataType.Double>;
    lowLowDeadband?: UAProperty<number, DataType.Double>;
}
export interface UALimitAlarm extends UAAlarmCondition, UALimitAlarm_Base {}