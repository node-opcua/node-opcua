// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { DTRange } from "./dt_range"
import { EnumAxisScale } from "./enum_axis_scale"
import { UADataItem, UADataItem_Base } from "./ua_data_item"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |ArrayItemType ns=0;i=12021                        |
 * |dataType        |Null                                              |
 * |dataType Name   |undefined ns=0;i=0                                |
 * |isAbstract      |true                                              |
 */
export interface UAArrayItem_Base<T, DT extends DataType>  extends UADataItem_Base<T/*g*/, DT> {
    instrumentRange?: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
    euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
    engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
    title: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
    axisScaleType: UAProperty<EnumAxisScale, /*z*/DataType.Int32>;
}
export interface UAArrayItem<T, DT extends DataType> extends UADataItem<T, /*m*/DT>, UAArrayItem_Base<T, DT /*A*/> {
}