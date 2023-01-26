// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |AudioVariableType ns=0;i=17986                    |
 * |dataType        |ByteString                                        |
 * |dataType Name   |Buffer ns=0;i=16307                               |
 * |isAbstract      |false                                             |
 */
export interface UAAudioVariable_Base<T extends Buffer>  extends UABaseDataVariable_Base<T, DataType.ByteString> {
    listId?: UAProperty<UAString, DataType.String>;
    agencyId?: UAProperty<UAString, DataType.String>;
    versionId?: UAProperty<UAString, DataType.String>;
}
export interface UAAudioVariable<T extends Buffer> extends UABaseDataVariable<T, DataType.ByteString>, UAAudioVariable_Base<T> {
}