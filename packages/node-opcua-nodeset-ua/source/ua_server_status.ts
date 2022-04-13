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
export interface UAServerStatus_Base<T extends DTServerStatus/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ExtensionObject> {
    startTime: UABaseDataVariable<Date, /*z*/DataType.DateTime>;
    currentTime: UABaseDataVariable<Date, /*z*/DataType.DateTime>;
    state: UABaseDataVariable<EnumServerState, /*z*/DataType.Int32>;
    buildInfo: UABuildInfo<DTBuildInfo>;
    secondsTillShutdown: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    shutdownReason: UABaseDataVariable<LocalizedText, /*z*/DataType.LocalizedText>;
}
export interface UAServerStatus<T extends DTServerStatus/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ExtensionObject>, UAServerStatus_Base<T /*B*/> {
}