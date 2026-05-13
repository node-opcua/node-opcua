import type { UInt32 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

import type { DTBuildInfo } from "./dt_build_info";
import type { DTServerStatus } from "./dt_server_status";
import type { EnumServerState } from "./enum_server_state";
import type { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable";
import type { UABuildInfo } from "./ua_build_info";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |ServerStatusType i=2138                                     |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTServerStatus i=862                                        |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAServerStatus_Base<T extends DTServerStatus>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    startTime: UABaseDataVariable<Date, DataType.DateTime>;
    currentTime: UABaseDataVariable<Date, DataType.DateTime>;
    state: UABaseDataVariable<EnumServerState, DataType.Int32>;
    buildInfo: UABuildInfo<DTBuildInfo>;
    secondsTillShutdown: UABaseDataVariable<UInt32, DataType.UInt32>;
    shutdownReason: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
}
export interface UAServerStatus<T extends DTServerStatus> extends UABaseDataVariable<T, DataType.ExtensionObject>, UAServerStatus_Base<T> {}