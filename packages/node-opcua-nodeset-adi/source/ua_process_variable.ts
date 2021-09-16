// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UADataItem, UADataItem_Base } from "node-opcua-nodeset-ua/source/ua_data_item"
/**
 * Provides a stable address space view from the
 * user point of view even if the ADI server address
 * space changes, after the new configuration is
 * loaded.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                  |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |2:ProcessVariableType ns=2;i=2008                 |
 * |dataType        |Null                                              |
 * |dataType Name   |undefined ns=0;i=0                                |
 * |isAbstract      |false                                             |
 */
export interface UAProcessVariable_Base<T, DT extends DataType>  extends UADataItem_Base<T/*g*/, DT> {
}
export interface UAProcessVariable<T, DT extends DataType> extends UADataItem<T, /*m*/DT>, UAProcessVariable_Base<T, DT /*A*/> {
}