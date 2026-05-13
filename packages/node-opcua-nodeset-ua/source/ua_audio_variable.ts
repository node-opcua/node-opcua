import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |AudioVariableType i=17986                                   |
 * |dataType        |ByteString                                                  |
 * |dataType Name   |Buffer i=16307                                              |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAAudioVariable_Base<T extends Buffer>  extends UABaseDataVariable_Base<T, DataType.ByteString> {
    listId?: UAProperty<UAString, DataType.String>;
    agencyId?: UAProperty<UAString, DataType.String>;
    versionId?: UAProperty<UAString, DataType.String>;
}
export interface UAAudioVariable<T extends Buffer> extends UABaseDataVariable<T, DataType.ByteString>, UAAudioVariable_Base<T> {}