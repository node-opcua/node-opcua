// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UInt16 } from "node-opcua-basic-types"
import { UABaseDataVariable } from "./ua_base_data_variable"
import { UAAlarmRateVariable } from "./ua_alarm_rate_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AlarmMetricsType ns=0;i=17279                     |
 * |isAbstract      |false                                             |
 */
export interface UAAlarmMetrics_Base {
    alarmCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    startTime: UABaseDataVariable<Date, /*z*/DataType.DateTime>;
    maximumActiveState: UABaseDataVariable<number, /*z*/DataType.Double>;
    maximumUnAck: UABaseDataVariable<number, /*z*/DataType.Double>;
    currentAlarmRate: UAAlarmRateVariable<number>;
    maximumAlarmRate: UAAlarmRateVariable<number>;
    maximumReAlarmCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    averageAlarmRate: UAAlarmRateVariable<number>;
    reset: UAMethod;
}
export interface UAAlarmMetrics extends UAObject, UAAlarmMetrics_Base {
}