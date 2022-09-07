// ----- this file has been automatically generated - do not edit
import { DataType, VariantOptions } from "node-opcua-variant"
import { UADataItem, UADataItem_Base } from "node-opcua-nodeset-ua/source/ua_data_item"
/**
 * Expose key results of an analyser and the
 * associated values that qualified it
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                  |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |2:EngineeringValueType ns=2;i=9380                |
 * |dataType        |Null                                              |
 * |dataType Name   |VariantOptions ns=0;i=0                           |
 * |isAbstract      |false                                             |
 */
export type UAEngineeringValue_Base<T, DT extends DataType> = UADataItem_Base<T, DT>;
export interface UAEngineeringValue<T, DT extends DataType> extends UADataItem<T, DT>, UAEngineeringValue_Base<T, DT> {
}