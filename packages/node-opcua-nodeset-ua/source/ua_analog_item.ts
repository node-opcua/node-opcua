// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { DTRange } from "./dt_range"
import { UABaseAnalog, UABaseAnalog_Base } from "./ua_base_analog"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |AnalogItemType i=2368                                       |
 * |dataType        |Variant                                                     |
 * |dataType Name   |Variant i=26                                                |
 * |isAbstract      |false                                                       |
 */
export interface UAAnalogItem_Base<T, DT extends DataType>  extends UABaseAnalog_Base<T, DT> {
    euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAAnalogItem<T, DT extends DataType> extends Omit<UABaseAnalog<T, DT>, "euRange">, UAAnalogItem_Base<T, DT> {
}