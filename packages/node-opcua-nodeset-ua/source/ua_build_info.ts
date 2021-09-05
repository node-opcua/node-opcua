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
export interface UABuildInfo_Base<T extends DTBuildInfo/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ExtensionObject> {
    productUri: UABaseDataVariable<UAString, /*z*/DataType.String>;
    manufacturerName: UABaseDataVariable<UAString, /*z*/DataType.String>;
    productName: UABaseDataVariable<UAString, /*z*/DataType.String>;
    softwareVersion: UABaseDataVariable<UAString, /*z*/DataType.String>;
    buildNumber: UABaseDataVariable<UAString, /*z*/DataType.String>;
    buildDate: UABaseDataVariable<Date, /*z*/DataType.DateTime>;
}
export interface UABuildInfo<T extends DTBuildInfo/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ExtensionObject>, UABuildInfo_Base<T /*B*/> {
}