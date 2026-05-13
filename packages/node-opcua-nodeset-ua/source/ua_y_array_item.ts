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
 * |typedDefinition |YArrayItemType i=12029                                      |
 * |dataType        |Null                                                        |
 * |dataType Name   |VariantOptions[] i=0                                        |
 * |value rank      |1                                                           |
 * |isAbstract      |false                                                       |
 */
export interface UAYArrayItem_Base<T, DT extends DataType>  extends UAArrayItem_Base<T, DT> {
    xAxisDefinition: UAProperty<DTAxisInformation, DataType.ExtensionObject>;
}
export interface UAYArrayItem<T, DT extends DataType> extends UAArrayItem<T, DT>, UAYArrayItem_Base<T, DT> {}