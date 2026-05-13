import type { UAProperty } from "node-opcua-address-space-base";
import type { EUInformation } from "node-opcua-data-access";
import type { LocalizedText } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

import type { DTRange } from "./dt_range";
import type { EnumAxisScale } from "./enum_axis_scale";
import type { UADataItem, UADataItem_Base } from "./ua_data_item";

// ----- this file has been automatically generated - do not edit

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
export interface UAArrayItem<T, DT extends DataType> extends UADataItem<T, DT>, UAArrayItem_Base<T, DT> {}