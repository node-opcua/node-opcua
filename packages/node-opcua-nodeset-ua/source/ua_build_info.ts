// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
import { DTBuildInfo } from "./dt_build_info"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |BuildInfoType ns=0;i=3051                         |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTBuildInfo ns=0;i=338                            |
 * |isAbstract      |false                                             |
 */
export interface UABuildInfo_Base<T extends DTBuildInfo>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    productUri: UABaseDataVariable<UAString, DataType.String>;
    manufacturerName: UABaseDataVariable<UAString, DataType.String>;
    productName: UABaseDataVariable<UAString, DataType.String>;
    softwareVersion: UABaseDataVariable<UAString, DataType.String>;
    buildNumber: UABaseDataVariable<UAString, DataType.String>;
    buildDate: UABaseDataVariable<Date, DataType.DateTime>;
}
export interface UABuildInfo<T extends DTBuildInfo> extends UABaseDataVariable<T, DataType.ExtensionObject>, UABuildInfo_Base<T> {
}