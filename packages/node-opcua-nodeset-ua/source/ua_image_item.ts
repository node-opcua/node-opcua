import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTAxisInformation } from "./dt_axis_information";
import type { UAArrayItem, UAArrayItem_Base } from "./ua_array_item";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |ImageItemType i=12047                                       |
 * |dataType        |Null                                                        |
 * |dataType Name   |VariantOptions[] i=0                                        |
 * |value rank      |2                                                           |
 * |isAbstract      |false                                                       |
 */
export interface UAImageItem_Base<T, DT extends DataType>  extends UAArrayItem_Base<T, DT> {
    xAxisDefinition: UAProperty<DTAxisInformation, DataType.ExtensionObject>;
    yAxisDefinition: UAProperty<DTAxisInformation, DataType.ExtensionObject>;
}
export interface UAImageItem<T, DT extends DataType> extends UAArrayItem<T, DT>, UAImageItem_Base<T, DT> {}