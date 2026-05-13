import type { UAObject } from "node-opcua-address-space-base";
import type { Int32 } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { DTPackMLAlarm } from "./dt_pack_ml_alarm";
import type { DTPackMLCount } from "./dt_pack_ml_count";
import type { DTPackMLDescriptor } from "./dt_pack_ml_descriptor";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PackML/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PackMLAdminObjectType i=5                                   |
 * |isAbstract      |false                                                       |
 */
export interface UAPackMLAdminObject_Base {
    accTimeSinceReset?: UABaseDataVariable<Int32, DataType.Int32>;
    alarm?: UABaseDataVariable<DTPackMLAlarm[], DataType.ExtensionObject>;
    alarmExtent?: UABaseDataVariable<Int32, DataType.Int32>;
    alarmHistory?: UABaseDataVariable<DTPackMLAlarm[], DataType.ExtensionObject>;
    alarmHistoryExtent?: UABaseDataVariable<Int32, DataType.Int32>;
    machDesignSpeed?: UABaseDataVariable<number, DataType.Float>;
    modeCumulativeTime?: UABaseDataVariable<Int32[], DataType.Int32>;
    modeCurrentTime?: UABaseDataVariable<Int32[], DataType.Int32>;
    parameter?: UABaseDataVariable<DTPackMLDescriptor[], DataType.ExtensionObject>;
    prodConsumedCount?: UABaseDataVariable<DTPackMLCount[], DataType.ExtensionObject>;
    prodDefectiveCount?: UABaseDataVariable<DTPackMLCount[], DataType.ExtensionObject>;
    prodProcessedCount?: UABaseDataVariable<DTPackMLCount[], DataType.ExtensionObject>;
    stateCumulativeTime?: UABaseDataVariable<Int32[], DataType.Int32>;
    stateCurrentTime?: UABaseDataVariable<Int32[], DataType.Int32>;
    stopReason?: UABaseDataVariable<DTPackMLAlarm, DataType.ExtensionObject>;
    stopReasonExtent?: UABaseDataVariable<Int32, DataType.Int32>;
    warning?: UABaseDataVariable<DTPackMLAlarm[], DataType.ExtensionObject>;
    warningExtent?: UABaseDataVariable<Int32, DataType.Int32>;
}
export interface UAPackMLAdminObject extends UAObject, UAPackMLAdminObject_Base {}