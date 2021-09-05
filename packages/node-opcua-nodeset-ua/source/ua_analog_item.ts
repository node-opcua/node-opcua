// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { DTRange } from "./dt_range"
import { UABaseAnalog, UABaseAnalog_Base } from "./ua_base_analog"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |AnalogItemType ns=0;i=2368                        |
 * |dataType        |Variant                                           |
 * |dataType Name   |Variant ns=0;i=26                                 |
 * |isAbstract      |false                                             |
 */
export interface UAAnalogItem_Base<T, DT extends DataType>  extends UABaseAnalog_Base<T/*g*/, DT> {
    euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAAnalogItem<T, DT extends DataType> extends Omit<UABaseAnalog<T, /*m*/DT>, "euRange">, UAAnalogItem_Base<T, DT /*A*/> {
}