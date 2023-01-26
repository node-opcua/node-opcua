// ----- this file has been automatically generated - do not edit
import { DataType, VariantOptions } from "node-opcua-variant"
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
 * |dataType Name   |VariantOptions ns=0;i=0                           |
 * |isAbstract      |false                                             |
 */
export type UAProcessVariable_Base<T, DT extends DataType> = UADataItem_Base<T, DT>;
export interface UAProcessVariable<T, DT extends DataType> extends UADataItem<T, DT>, UAProcessVariable_Base<T, DT> {
}