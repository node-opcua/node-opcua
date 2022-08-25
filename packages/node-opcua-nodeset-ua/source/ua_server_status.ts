// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UInt32 } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
import { DTServerStatus } from "./dt_server_status"
import { EnumServerState } from "./enum_server_state"
import { DTBuildInfo } from "./dt_build_info"
import { UABuildInfo } from "./ua_build_info"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |ServerStatusType ns=0;i=2138                      |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTServerStatus ns=0;i=862                         |
 * |isAbstract      |false                                             |
 */
export interface UAServerStatus_Base<T extends DTServerStatus>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    startTime: UABaseDataVariable<Date, DataType.DateTime>;
    currentTime: UABaseDataVariable<Date, DataType.DateTime>;
    state: UABaseDataVariable<EnumServerState, DataType.Int32>;
    buildInfo: UABuildInfo<DTBuildInfo>;
    secondsTillShutdown: UABaseDataVariable<UInt32, DataType.UInt32>;
    shutdownReason: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
}
export interface UAServerStatus<T extends DTServerStatus> extends UABaseDataVariable<T, DataType.ExtensionObject>, UAServerStatus_Base<T> {
}