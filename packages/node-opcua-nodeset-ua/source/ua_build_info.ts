import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { DTBuildInfo } from "./dt_build_info";
import type { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |BuildInfoType i=3051                                        |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTBuildInfo i=338                                           |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UABuildInfo_Base<T extends DTBuildInfo>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    productUri: UABaseDataVariable<UAString, DataType.String>;
    manufacturerName: UABaseDataVariable<UAString, DataType.String>;
    productName: UABaseDataVariable<UAString, DataType.String>;
    softwareVersion: UABaseDataVariable<UAString, DataType.String>;
    buildNumber: UABaseDataVariable<UAString, DataType.String>;
    buildDate: UABaseDataVariable<Date, DataType.DateTime>;
}
export interface UABuildInfo<T extends DTBuildInfo> extends UABaseDataVariable<T, DataType.ExtensionObject>, UABuildInfo_Base<T> {}