// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { Int32 } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTPackMLAlarm } from "./dt_pack_ml_alarm"
import { DTPackMLDescriptor } from "./dt_pack_ml_descriptor"
import { DTPackMLCount } from "./dt_pack_ml_count"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PackML/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |15:PackMLAdminObjectType ns=15;i=5                |
 * |isAbstract      |false                                             |
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
export interface UAPackMLAdminObject extends UAObject, UAPackMLAdminObject_Base {
}