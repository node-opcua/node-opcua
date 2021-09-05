// ----- this file has been automatically generated - do not edit
import { UAVariableT } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |BaseDataVariableType ns=0;i=63                    |
 * |dataType        |Null                                              |
 * |dataType Name   |undefined ns=0;i=0                                |
 * |isAbstract      |false                                             |
 */
export interface UABaseDataVariable_Base<T, DT extends DataType>  {
}
export interface UABaseDataVariable<T, DT extends DataType> extends UAVariableT<T, /*m*/DT>, UABaseDataVariable_Base<T, DT /*A*/> {
}