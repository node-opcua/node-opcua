// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UADataItem, UADataItem_Base } from "./ua_data_item"
import { DTRange } from "./dt_range"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |BaseAnalogType ns=0;i=15318                       |
 * |dataType        |Variant                                           |
 * |dataType Name   |Variant ns=0;i=26                                 |
 * |isAbstract      |false                                             |
 */
export interface UABaseAnalog_Base<T, DT extends DataType>  extends UADataItem_Base<T/*g*/, DT> {
    instrumentRange?: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
    euRange?: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
    engineeringUnits?: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
}
export interface UABaseAnalog<T, DT extends DataType> extends UADataItem<T, /*m*/DT>, UABaseAnalog_Base<T, DT /*A*/> {
}