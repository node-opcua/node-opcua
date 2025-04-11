// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { DTRange } from "./dt_range"
import { EnumAxisScale } from "./enum_axis_scale"
import { UADataItem, UADataItem_Base } from "./ua_data_item"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |ArrayItemType i=12021                                       |
 * |dataType        |Null                                                        |
 * |dataType Name   |VariantOptions i=0                                          |
 * |value rank      |-1                                                          |
 * |isAbstract      |true                                                        |
 */
export interface UAArrayItem_Base<T, DT extends DataType>  extends UADataItem_Base<T, DT> {
    instrumentRange?: UAProperty<DTRange, DataType.ExtensionObject>;
    euRange: UAProperty<DTRange, DataType.ExtensionObject>;
    engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
    title: UAProperty<LocalizedText, DataType.LocalizedText>;
    axisScaleType: UAProperty<EnumAxisScale, DataType.Int32>;
}
export interface UAArrayItem<T, DT extends DataType> extends UADataItem<T, DT>, UAArrayItem_Base<T, DT> {
}