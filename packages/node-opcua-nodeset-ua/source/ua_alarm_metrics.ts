import type { UAMethod, UAObject } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAAlarmRateVariable } from "./ua_alarm_rate_variable";
import type { UABaseDataVariable } from "./ua_base_data_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AlarmMetricsType i=17279                                    |
 * |isAbstract      |false                                                       |
 */
export interface UAAlarmMetrics_Base {
    alarmCount: UABaseDataVariable<UInt32, DataType.UInt32>;
    startTime: UABaseDataVariable<Date, DataType.DateTime>;
    maximumActiveState: UABaseDataVariable<number, DataType.Double>;
    maximumUnAck: UABaseDataVariable<number, DataType.Double>;
    currentAlarmRate: UAAlarmRateVariable<number>;
    maximumAlarmRate: UAAlarmRateVariable<number>;
    maximumReAlarmCount: UABaseDataVariable<UInt32, DataType.UInt32>;
    averageAlarmRate: UAAlarmRateVariable<number>;
    reset: UAMethod;
}
export interface UAAlarmMetrics extends UAObject, UAAlarmMetrics_Base {}